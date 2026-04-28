package com.poliwise.auth.controller;

import com.poliwise.auth.dto.auth.*;
import com.poliwise.auth.entity.RefreshToken;
import com.poliwise.auth.repository.RefreshTokenRepository;
import com.poliwise.auth.repository.UserRepository;
import com.poliwise.auth.security.JwtAuthenticationToken;
import com.poliwise.auth.service.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final RefreshTokenService refreshTokenService;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final ForgotPasswordService forgotPasswordService;
    private final ChangePasswordService changePasswordService;

    public AuthController(
            AuthService authService,
            RefreshTokenService refreshTokenService,
            UserRepository userRepository,
            RefreshTokenRepository refreshTokenRepository,
            ForgotPasswordService forgotPasswordService,
            ChangePasswordService changePasswordService
    ) {
        this.authService = authService;
        this.refreshTokenService = refreshTokenService;
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.forgotPasswordService = forgotPasswordService;
        this.changePasswordService = changePasswordService;
    }

    @PostMapping("/register")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request, HttpServletRequest httpRequest) {
        JwtAuthenticationToken authToken = extractAuthToken(httpRequest);
        var user = authService.register(request, authToken != null ? authToken.getPayload().sub() : null);
        return ResponseEntity.status(HttpStatus.CREATED).body(user);
    }

    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        ClientMetadata metadata = extractMetadata(httpRequest);
        TokenResponse response = authService.login(request, metadata);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/refresh")
    public ResponseEntity<TokenResponse> refresh(
            @Valid @RequestBody RefreshTokenRequest request,
            @RequestHeader("X-User-Id") UUID userId,
            HttpServletRequest httpRequest) {
        ClientMetadata metadata = extractMetadata(httpRequest);
        TokenResponse response = authService.refresh(request.refreshToken(), userId, metadata);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(
            @Valid @RequestBody LogoutRequest request,
            HttpServletRequest httpRequest) {

        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication instanceof JwtAuthenticationToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Authentication required"));
        }

        String rawAccessToken = extractRawAccessToken(httpRequest);
        authService.logout(request.refreshToken(), ((JwtAuthenticationToken) authentication).getPayload().sub(), rawAccessToken);

        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    @PostMapping("/logout-all")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> logoutAll(HttpServletRequest httpRequest) {

        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication instanceof JwtAuthenticationToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Authentication required"));
        }

        String rawAccessToken = extractRawAccessToken(httpRequest);
        int count = authService.logoutAllDevices(((JwtAuthenticationToken) authentication).getPayload().sub(), rawAccessToken);
        return ResponseEntity.ok(Map.of("message", "Logged out from all devices", "sessionsRevoked", count));
    }

    @GetMapping("/sessions")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getActiveSessions(HttpServletRequest httpRequest) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication instanceof JwtAuthenticationToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Authentication required"));
        }

        JwtAuthenticationToken authToken = (JwtAuthenticationToken) authentication;
        UUID userId = authToken.getPayload().sub();
        String jti = authToken.getPayload().jti();
        UUID currentSessionId = jti != null ? UUID.fromString(jti) : null;

        List<RefreshToken> activeTokens = refreshTokenRepository.findActiveTokensByUserId(
                userId, OffsetDateTime.now(ZoneOffset.UTC));

        List<SessionInfo> sessions = activeTokens.stream()
                .map(token -> new SessionInfo(
                        token.getId(),
                        token.getDeviceInfo(),
                        token.getIpAddress(),
                        token.getCreatedAt(),
                        token.getExpiresAt(),
                        token.getId().equals(currentSessionId)
                ))
                .toList();

        return ResponseEntity.ok(Map.of("sessions", sessions));
    }

    @DeleteMapping("/sessions/{sessionId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> revokeSession(@PathVariable UUID sessionId) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication instanceof JwtAuthenticationToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Authentication required"));
        }

        UUID userId = ((JwtAuthenticationToken) authentication).getPayload().sub();
        refreshTokenService.revokeSession(userId, sessionId);

        return ResponseEntity.ok(Map.of("message", "Session revoked successfully"));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ForgotPasswordResponse> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request
    ) {
        ForgotPasswordResponse response = forgotPasswordService.processForgotPassword(request.email());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/change-password")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication instanceof JwtAuthenticationToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Authentication required"));
        }

        var result = changePasswordService.changePassword(
                ((JwtAuthenticationToken) authentication).getPayload().sub(),
                request.oldPassword(),
                request.newPassword(),
                request.confirmPassword()
        );

        if (result.success()) {
            return ResponseEntity.ok(result);
        } else {
            return ResponseEntity.badRequest().body(result);
        }
    }

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getProfile() {
        // Note: @AuthenticationPrincipal doesn't work reliably with custom Authentication
        // implementations in this Spring Security setup. Read from SecurityContextHolder instead.
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication instanceof JwtAuthenticationToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Authentication required"));
        }

        JwtAuthenticationToken authToken = (JwtAuthenticationToken) authentication;
        UUID userId = authToken.getPayload().sub();
        var user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        var profile = new UserProfileView(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                null,
                user.getRole().name(),
                user.getStatus().name(),
                user.getDepartmentId(),
                null,
                user.getCreatedAt(),
                user.getPasswordChangedAt(),
                user.getMustChangePassword() != null && user.getMustChangePassword()
        );

        return ResponseEntity.ok(profile);
    }

    private JwtAuthenticationToken extractAuthToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String rawToken = header.substring(7).trim();
            try {
                return authService.extractToken(rawToken);
            } catch (Exception e) {
                return null;
            }
        }
        return null;
    }

    private ClientMetadata extractMetadata(HttpServletRequest request) {
        String ipAddress = resolveIpAddress(request);
        String userAgent = request.getHeader("User-Agent");
        String deviceInfo = parseDeviceType(userAgent);
        return new ClientMetadata(ipAddress, userAgent, deviceInfo);
    }

    private String resolveIpAddress(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp.trim();
        }
        return request.getRemoteAddr();
    }

    private String parseDeviceType(String userAgent) {
        if (userAgent == null) return "Unknown";
        String ua = userAgent.toLowerCase();
        if (ua.contains("mobile") || ua.contains("android") || ua.contains("iphone")) {
            return "Mobile";
        }
        if (ua.contains("tablet") || ua.contains("ipad")) {
            return "Tablet";
        }
        return "Desktop";
    }

    private String extractRawAccessToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7).trim();
        }
        return null;
    }

    private UUID extractCurrentSessionId(JwtAuthenticationToken authToken) {
        String jti = authToken.getPayload().jti();
        return jti != null ? UUID.fromString(jti) : null;
    }
}
