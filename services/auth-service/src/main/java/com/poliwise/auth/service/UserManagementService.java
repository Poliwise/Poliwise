package com.poliwise.auth.service;

import com.poliwise.auth.dto.auth.*;
import com.poliwise.auth.entity.LoginHistory;
import com.poliwise.auth.entity.RefreshToken;
import com.poliwise.auth.entity.User;
import com.poliwise.auth.enums.AccountStatus;
import com.poliwise.auth.enums.LoginStatus;
import com.poliwise.auth.enums.UserRole;
import com.poliwise.auth.repository.LoginHistoryRepository;
import com.poliwise.auth.repository.RefreshTokenRepository;
import com.poliwise.auth.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class UserManagementService {

    private final UserRepository userRepository;
    private final LoginHistoryRepository loginHistoryRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordService passwordService;
    private final EmailService emailService;

    public UserManagementService(
            UserRepository userRepository,
            LoginHistoryRepository loginHistoryRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordService passwordService,
            EmailService emailService
    ) {
        this.userRepository = userRepository;
        this.loginHistoryRepository = loginHistoryRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordService = passwordService;
        this.emailService = emailService;
    }

    @Transactional
    public AuthUserView createUser(UserCreateRequest request, UUID createdBy) {
        String normalizedUsername = normalize(request.username());
        String normalizedEmail = normalize(request.email());

        if (userRepository.existsByUsernameIgnoreCase(normalizedUsername)) {
            throw new IllegalArgumentException("Username already exists");
        }
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new IllegalArgumentException("Email already exists");
        }

        String tempPassword = passwordService.generateSecurePassword();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        User user = User.builder()
                .id(UUID.randomUUID())
                .username(normalizedUsername)
                .email(normalizedEmail)
                .passwordHash(passwordService.hashPassword(tempPassword))
                .role(UserRole.valueOf(request.role()))
                .status(AccountStatus.ACTIVE)
                .failedLoginAttempts(0)
                .mustChangePassword(true)
                .passwordChangedAt(now)
                .departmentId(request.departmentId())
                .createdBy(createdBy)
                .createdAt(now)
                .updatedAt(now)
                .build();

        User savedUser = userRepository.save(user);

        emailService.sendAccountCredentials(savedUser.getEmail(), savedUser.getUsername(), tempPassword);

        return toAuthUserView(savedUser, createdBy);
    }

    @Transactional
    public BulkUserCreateResponse createBulkUsers(BulkUserCreateRequest request, UUID createdBy) {
        List<BulkUserCreateResponse.CreatedUserInfo> successfulUsers = new ArrayList<>();
        List<BulkUserCreateResponse.FailedUserInfo> failedUsers = new ArrayList<>();

        for (BulkUserCreateRequest.UserCreateItem item : request.users()) {
            try {
                String normalizedUsername = normalize(item.username());
                String normalizedEmail = normalize(item.email());

                if (userRepository.existsByUsernameIgnoreCase(normalizedUsername)) {
                    failedUsers.add(new BulkUserCreateResponse.FailedUserInfo(
                            item.username(), item.email(), "Username already exists"
                    ));
                    continue;
                }
                if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
                    failedUsers.add(new BulkUserCreateResponse.FailedUserInfo(
                            item.username(), item.email(), "Email already exists"
                    ));
                    continue;
                }

                String tempPassword = passwordService.generateSecurePassword();
                OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

                User user = User.builder()
                        .id(UUID.randomUUID())
                        .username(normalizedUsername)
                        .email(normalizedEmail)
                        .passwordHash(passwordService.hashPassword(tempPassword))
                        .role(UserRole.valueOf(item.role()))
                        .status(AccountStatus.ACTIVE)
                        .failedLoginAttempts(0)
                        .mustChangePassword(true)
                        .passwordChangedAt(now)
                        .departmentId(item.departmentId())
                        .createdBy(createdBy)
                        .createdAt(now)
                        .updatedAt(now)
                        .build();

                User savedUser = userRepository.save(user);

                emailService.sendBulkAccountCredentials(
                        savedUser.getEmail(),
                        savedUser.getUsername(),
                        tempPassword,
                        getAdminName(createdBy)
                );

                successfulUsers.add(new BulkUserCreateResponse.CreatedUserInfo(
                        savedUser.getId(),
                        savedUser.getUsername(),
                        savedUser.getEmail(),
                        tempPassword,
                        true
                ));
            } catch (Exception e) {
                failedUsers.add(new BulkUserCreateResponse.FailedUserInfo(
                        item.username(), item.email(), e.getMessage()
                ));
            }
        }

        return new BulkUserCreateResponse(
                request.users().size(),
                successfulUsers.size(),
                failedUsers.size(),
                successfulUsers,
                failedUsers
        );
    }

    public UserDetailView getUserById(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return toUserDetailView(user);
    }

    public Page<UserBasicView> searchUsers(
            String search,
            String role,
            String status,
            UUID departmentId,
            Pageable pageable
    ) {
        return userRepository.searchUsers(search, role, status, departmentId, pageable)
                .map(this::toUserBasicView);
    }

    @Transactional
    public UserDetailView updateUser(UUID userId, UserUpdateRequest request, UUID updatedBy) {
        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        boolean changed = false;

        if (request.role() != null && !request.role().isEmpty()) {
            user.setRole(UserRole.valueOf(request.role()));
            changed = true;
        }

        if (request.status() != null && !request.status().isEmpty()) {
            AccountStatus newStatus = AccountStatus.valueOf(request.status());
            AccountStatus oldStatus = user.getStatus();

            if (oldStatus != newStatus) {
                user.setStatus(newStatus);
                changed = true;

                if (newStatus == AccountStatus.DEACTIVATED) {
                    user.setDeactivatedAt(now);
                } else if (newStatus == AccountStatus.ACTIVE && oldStatus == AccountStatus.DEACTIVATED) {
                    user.setDeactivatedAt(null);
                } else if (newStatus == AccountStatus.REVOKED) {
                    user.setRevokedAt(now);
                    refreshTokenRepository.revokeAllActiveTokensByUserId(
                            userId, now, "ACCOUNT_REVOKED"
                    );
                }
            }
        }

        if (request.departmentId() != null) {
            user.setDepartmentId(request.departmentId());
            changed = true;
        }

        if (changed) {
            user.setUpdatedAt(now);
            userRepository.save(user);
        }

        return toUserDetailView(user);
    }

    @Transactional
    public void deactivateUser(UUID userId) {
        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (user.getStatus() == AccountStatus.REVOKED) {
            throw new IllegalArgumentException("Cannot deactivate a revoked user");
        }

        user.setStatus(AccountStatus.DEACTIVATED);
        user.setDeactivatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        user.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));

        refreshTokenRepository.revokeAllActiveTokensByUserId(
                userId, OffsetDateTime.now(ZoneOffset.UTC), "USER_DEACTIVATED"
        );

        userRepository.save(user);
    }

    @Transactional
    public void reactivateUser(UUID userId) {
        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (user.getStatus() != AccountStatus.DEACTIVATED) {
            throw new IllegalArgumentException("User is not deactivated");
        }

        user.setStatus(AccountStatus.ACTIVE);
        user.setDeactivatedAt(null);
        user.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));

        userRepository.save(user);
    }

    @Transactional
    public void revokeUser(UUID userId) {
        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (user.getStatus() == AccountStatus.REVOKED) {
            throw new IllegalArgumentException("User is already revoked");
        }

        user.setStatus(AccountStatus.REVOKED);
        user.setRevokedAt(OffsetDateTime.now(ZoneOffset.UTC));
        user.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));

        refreshTokenRepository.revokeAllActiveTokensByUserId(
                userId, OffsetDateTime.now(ZoneOffset.UTC), "USER_REVOKED"
        );

        userRepository.save(user);
    }

    @Transactional
    public void deleteUser(UUID userId) {
        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (user.getStatus() == AccountStatus.ACTIVE) {
            throw new IllegalArgumentException("Cannot delete an active user. Deactivate or revoke first.");
        }

        refreshTokenRepository.revokeAllActiveTokensByUserId(
                userId, OffsetDateTime.now(ZoneOffset.UTC), "USER_DELETED"
        );

        userRepository.delete(user);
    }

    public Page<LoginHistoryInfo> getLoginHistory(UUID userId, Pageable pageable) {
        return loginHistoryRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(this::toLoginHistoryInfo);
    }

    public List<SessionInfo> getActiveSessions(UUID userId, UUID currentSessionId) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        List<RefreshToken> activeTokens = refreshTokenRepository.findActiveTokensByUserId(userId, now);

        return activeTokens.stream()
                .map(token -> new SessionInfo(
                        token.getId(),
                        token.getDeviceInfo(),
                        token.getIpAddress(),
                        token.getCreatedAt(),
                        token.getExpiresAt(),
                        token.getId().equals(currentSessionId)
                ))
                .toList();
    }

    @Transactional
    public void revokeSession(UUID userId, UUID sessionId) {
        refreshTokenRepository.findById(sessionId).ifPresent(token -> {
            if (!token.getUserId().equals(userId)) {
                throw new IllegalArgumentException("Session does not belong to user");
            }
            refreshTokenRepository.revokeToken(
                    sessionId,
                    OffsetDateTime.now(ZoneOffset.UTC),
                    "SESSION_REVOKED_BY_USER",
                    null
            );
        });
    }

    private String getAdminName(UUID adminId) {
        if (adminId == null) return "Administrator";
        return userRepository.findById(adminId)
                .map(User::getUsername)
                .orElse("Administrator");
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase();
    }

    private AuthUserView toAuthUserView(User user, UUID registeredBy) {
        return new AuthUserView(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getRole(),
                user.getStatus(),
                user.getMustChangePassword(),
                registeredBy
        );
    }

    private UserDetailView toUserDetailView(User user) {
        return new UserDetailView(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                null,
                user.getRole().name(),
                user.getStatus().name(),
                user.getDepartmentId(),
                user.getCreatedAt(),
                user.getUpdatedAt(),
                user.getCreatedBy(),
                user.getFailedLoginAttempts() != null ? user.getFailedLoginAttempts() : 0,
                user.getPasswordChangedAt(),
                user.getMustChangePassword() != null && user.getMustChangePassword()
        );
    }

    private UserBasicView toUserBasicView(User user) {
        return new UserBasicView(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getRole().name(),
                user.getStatus().name(),
                user.getDepartmentId()
        );
    }

    private LoginHistoryInfo toLoginHistoryInfo(LoginHistory history) {
        return new LoginHistoryInfo(
                history.getId(),
                history.getUsername(),
                history.getIpAddress(),
                history.getDeviceType(),
                history.getLocation(),
                history.getStatus().name(),
                history.getFailureReason(),
                history.getCreatedAt()
        );
    }
}
