package com.poliwise.auth.service;

import com.poliwise.auth.config.AuthProperties;
import com.poliwise.auth.dto.auth.AuthUserView;
import com.poliwise.auth.dto.auth.ClientMetadata;
import com.poliwise.auth.dto.auth.JwtPayload;
import com.poliwise.auth.dto.auth.LoginRequest;
import com.poliwise.auth.dto.auth.RegisterRequest;
import com.poliwise.auth.dto.auth.TokenResponse;
import com.poliwise.auth.entity.LoginHistory;
import com.poliwise.auth.entity.RefreshToken;
import com.poliwise.auth.entity.User;
import com.poliwise.auth.enums.AccountStatus;
import com.poliwise.auth.enums.LoginStatus;
import com.poliwise.auth.enums.UserRole;
import com.poliwise.auth.repository.LoginHistoryRepository;
import com.poliwise.auth.repository.RefreshTokenRepository;
import com.poliwise.auth.repository.UserRepository;
import io.jsonwebtoken.JwtException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final LoginHistoryRepository loginHistoryRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final AuthProperties authProperties;

    @Transactional
    public AuthUserView register(RegisterRequest request) {
        String normalizedUsername = normalize(request.username());
        String normalizedEmail = normalize(request.email());

        if (userRepository.existsByUsernameIgnoreCase(normalizedUsername)) {
            throw conflict("Username already exists");
        }
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw conflict("Email already exists");
        }

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        User user = User.builder().id(UUID.randomUUID()).username(normalizedUsername)
                .email(normalizedEmail).passwordHash(passwordEncoder.encode(request.password()))
                .role(request.role() == null ? UserRole.USER : request.role())
                .status(AccountStatus.ACTIVE).failedLoginAttempts(0)
                .mustChangePassword(Boolean.FALSE).passwordChangedAt(now).createdAt(now)
                .updatedAt(now).build();

        User savedUser = userRepository.save(user);
        return toUserView(savedUser);
    }

    @Transactional
    public TokenResponse loginLocal(LoginRequest request, ClientMetadata metadata) {
        String identifier = normalize(request.identifier());

        Optional<User> candidate =
                userRepository.findByUsernameIgnoreCaseOrEmailIgnoreCase(identifier, identifier);
        if (candidate.isEmpty()) {
            saveFailedHistory(null, identifier, metadata, LoginStatus.FAILED_CREDENTIALS,
                    "USER_NOT_FOUND");
            throw unauthorized("Invalid credentials");
        }

        User user = candidate.get();

        if (user.getStatus() == AccountStatus.DEACTIVATED) {
            saveFailedHistory(user.getId(), user.getUsername(), metadata,
                    LoginStatus.FAILED_DEACTIVATED, "ACCOUNT_DEACTIVATED");
            throw forbidden("Account is deactivated");
        }

        if (user.getStatus() == AccountStatus.REVOKED) {
            saveFailedHistory(user.getId(), user.getUsername(), metadata,
                    LoginStatus.FAILED_REVOKED, "ACCOUNT_REVOKED");
            throw forbidden("Account is revoked");
        }

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        if (isLocked(user, now)) {
            saveFailedHistory(user.getId(), user.getUsername(), metadata, LoginStatus.FAILED_LOCKED,
                    "ACCOUNT_LOCKED");
            throw forbidden("Account is temporarily locked");
        }

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            processFailedLogin(user, now);
            saveFailedHistory(user.getId(), user.getUsername(), metadata,
                    LoginStatus.FAILED_CREDENTIALS, "WRONG_PASSWORD");
            throw unauthorized("Invalid credentials");
        }

        resetLockStateIfNeeded(user, now);

        saveSuccessHistory(user, metadata);
        return issueTokens(user, metadata, now);
    }

    @Transactional
    public TokenResponse refreshToken(String rawRefreshToken, UUID userId,
            ClientMetadata metadata) {
        String refreshTokenHash = hashRefreshToken(rawRefreshToken);

        RefreshToken existingToken =
                refreshTokenRepository.findByTokenHashForUpdate(refreshTokenHash)
                        .orElseThrow(() -> unauthorized("Invalid refresh token"));

        if (!existingToken.getUserId().equals(userId)) {
            throw unauthorized("Token does not belong to user");
        }

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        if (isRefreshTokenExpired(existingToken, now)) {
            refreshTokenRepository.revokeToken(existingToken.getId(), now, "TOKEN_EXPIRED", null);
            throw unauthorized("Refresh token expired");
        }

        if (Boolean.TRUE.equals(existingToken.getRevoked())) {
            refreshTokenRepository.revokeAllActiveTokensByUserId(existingToken.getUserId(), now,
                    "TOKEN_REUSE_DETECTED");
            throw unauthorized("Refresh token has been revoked");
        }

        User user = userRepository.findById(existingToken.getUserId())
                .orElseThrow(() -> unauthorized("User not found"));

        if (user.getStatus() != AccountStatus.ACTIVE) {
            throw forbidden("Account is not active");
        }

        String nextRawRefreshToken = generateOpaqueRefreshToken();
        String nextHash = hashRefreshToken(nextRawRefreshToken);
        RefreshToken nextToken = createRefreshTokenEntity(user.getId(), nextHash, metadata, now);
        refreshTokenRepository.save(nextToken);

        int updated = refreshTokenRepository.revokeToken(existingToken.getId(), now,
                "TOKEN_ROTATION", nextToken.getId());
        if (updated == 0) {
            throw unauthorized("Refresh token is no longer valid");
        }

        return new TokenResponse(jwtTokenService.createAccessToken(user), nextRawRefreshToken,
                "Bearer", jwtTokenService.getAccessTokenExpiresInSeconds(), toUserView(user));
    }

    public JwtPayload verifyToken(String accessToken) {
        try {
            return jwtTokenService.verifyAccessToken(accessToken);
        } catch (JwtException | IllegalArgumentException ex) {
            throw unauthorized("Invalid access token");
        }
    }

    @Transactional
    public void logout(String rawRefreshToken, UUID userId) {
        String refreshTokenHash = hashRefreshToken(rawRefreshToken);

        RefreshToken token = refreshTokenRepository.findByTokenHashForUpdate(refreshTokenHash)
                .orElseThrow(() -> unauthorized("Invalid refresh token"));

        if (!token.getUserId().equals(userId)) {
            throw unauthorized("Token does not belong to user");
        }

        refreshTokenRepository.revokeToken(token.getId(), OffsetDateTime.now(ZoneOffset.UTC),
                "LOGOUT", null);
    }

    @Transactional
    public int logoutAllDevices(UUID userId) {
        return refreshTokenRepository.revokeAllActiveTokensByUserId(userId,
                OffsetDateTime.now(ZoneOffset.UTC), "LOGOUT_ALL_DEVICES");
    }

    private TokenResponse issueTokens(User user, ClientMetadata metadata, OffsetDateTime now) {
        String accessToken = jwtTokenService.createAccessToken(user);

        String rawRefreshToken = generateOpaqueRefreshToken();
        String hashedRefreshToken = hashRefreshToken(rawRefreshToken);

        RefreshToken refreshToken =
                createRefreshTokenEntity(user.getId(), hashedRefreshToken, metadata, now);
        refreshTokenRepository.save(refreshToken);

        return new TokenResponse(accessToken, rawRefreshToken, "Bearer",
                jwtTokenService.getAccessTokenExpiresInSeconds(), toUserView(user));
    }

    private RefreshToken createRefreshTokenEntity(UUID userId, String tokenHash,
            ClientMetadata metadata, OffsetDateTime now) {
        return RefreshToken.builder().id(UUID.randomUUID()).userId(userId).tokenHash(tokenHash)
                .deviceInfo(metadata.deviceInfo()).ipAddress(metadata.ipAddress())
                .userAgent(metadata.userAgent())
                .expiresAt(now.plus(authProperties.refreshToken().ttl())).revoked(Boolean.FALSE)
                .createdAt(now).build();
    }

    private void processFailedLogin(User user, OffsetDateTime now) {
        int attempts = user.getFailedLoginAttempts() == null ? 0 : user.getFailedLoginAttempts();
        attempts += 1;

        user.setFailedLoginAttempts(attempts);
        user.setUpdatedAt(now);

        if (attempts >= authProperties.login().maxFailedAttempts()) {
            user.setLockedUntil(now.plus(authProperties.login().lockDuration()));
            user.setFailedLoginAttempts(0);
        }

        userRepository.save(user);
    }

    private void resetLockStateIfNeeded(User user, OffsetDateTime now) {
        boolean changed = false;

        if (user.getFailedLoginAttempts() != null && user.getFailedLoginAttempts() > 0) {
            user.setFailedLoginAttempts(0);
            changed = true;
        }

        if (user.getLockedUntil() != null) {
            user.setLockedUntil(null);
            changed = true;
        }

        if (changed) {
            user.setUpdatedAt(now);
            userRepository.save(user);
        }
    }

    private boolean isLocked(User user, OffsetDateTime now) {
        return user.getLockedUntil() != null && user.getLockedUntil().isAfter(now);
    }

    private boolean isRefreshTokenExpired(RefreshToken token, OffsetDateTime now) {
        return token.getExpiresAt() == null || !token.getExpiresAt().isAfter(now);
    }

    private void saveSuccessHistory(User user, ClientMetadata metadata) {
        LoginHistory history = LoginHistory.builder().id(UUID.randomUUID()).userId(user.getId())
                .username(user.getUsername()).ipAddress(metadata.ipAddress())
                .userAgent(metadata.userAgent()).deviceType(metadata.deviceInfo())
                .status(LoginStatus.SUCCESS).createdAt(Instant.now()).build();
        loginHistoryRepository.save(history);
    }

    private void saveFailedHistory(UUID userId, String username, ClientMetadata metadata,
            LoginStatus status, String reason) {
        LoginHistory history = LoginHistory.builder().id(UUID.randomUUID()).userId(userId)
                .username(username == null ? "unknown" : username).ipAddress(metadata.ipAddress())
                .userAgent(metadata.userAgent()).deviceType(metadata.deviceInfo()).status(status)
                .failureReason(reason).createdAt(Instant.now()).build();
        loginHistoryRepository.save(history);
    }

    private AuthUserView toUserView(User user) {
        return new AuthUserView(user.getId(), user.getUsername(), user.getEmail(), user.getRole(),
                user.getStatus(), user.getMustChangePassword());
    }

    private String generateOpaqueRefreshToken() {
        byte[] randomBytes = new byte[64];
        SECURE_RANDOM.nextBytes(randomBytes);
        return HexFormat.of().formatHex(randomBytes);
    }

    private String hashRefreshToken(String rawRefreshToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawRefreshToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception ex) {
            throw new IllegalStateException("Cannot hash refresh token", ex);
        }
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase();
    }

    private ResponseStatusException unauthorized(String message) {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, message);
    }

    private ResponseStatusException forbidden(String message) {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, message);
    }

    private ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }
}
