package com.poliwise.auth.service;

import com.poliwise.auth.dto.auth.ForgotPasswordResponse;
import com.poliwise.auth.entity.User;
import com.poliwise.auth.enums.AccountStatus;
import com.poliwise.auth.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

@Service
public class ForgotPasswordService {

    private static final Logger log = LoggerFactory.getLogger(ForgotPasswordService.class);

    private final UserRepository userRepository;
    private final PasswordService passwordService;
    private final EmailService emailService;

    public ForgotPasswordService(
            UserRepository userRepository,
            PasswordService passwordService,
            EmailService emailService
    ) {
        this.userRepository = userRepository;
        this.passwordService = passwordService;
        this.emailService = emailService;
    }

    @Transactional
    public ForgotPasswordResponse processForgotPassword(String email) {
        String normalizedEmail = email.trim().toLowerCase();

        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(normalizedEmail);

        if (userOpt.isEmpty()) {
            log.info("Forgot password request for non-existent email: {}", maskEmail(normalizedEmail));
            return ForgotPasswordResponse.notFound();
        }

        User user = userOpt.get();

        if (user.getStatus() != AccountStatus.ACTIVE) {
            log.info("Forgot password request for non-active user: {}", user.getUsername());
            return ForgotPasswordResponse.notFound();
        }

        String newPassword = passwordService.generateSecurePassword();
        String hashedPassword = passwordService.hashPassword(newPassword);

        user.setPasswordHash(hashedPassword);
        user.setPasswordChangedAt(OffsetDateTime.now(ZoneOffset.UTC));
        user.setMustChangePassword(true);
        user.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);

        userRepository.save(user);

        log.info("Password reset successfully for user: {}", user.getUsername());

        emailService.sendPasswordReset(user.getEmail(), user.getUsername(), newPassword);

        return ForgotPasswordResponse.success();
    }

    private String maskEmail(String email) {
        if (email == null || email.length() < 4) return "***";
        int atIndex = email.indexOf('@');
        if (atIndex <= 1) return "***" + email.substring(atIndex);
        return email.substring(0, 2) + "***" + email.substring(atIndex);
    }
}
