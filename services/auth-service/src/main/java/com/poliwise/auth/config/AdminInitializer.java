package com.poliwise.auth.config;

import com.poliwise.auth.entity.User;
import com.poliwise.auth.enums.AccountStatus;
import com.poliwise.auth.enums.UserRole;
import com.poliwise.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * Initializes default admin account on application startup.
 * Creates the admin user only if it does not already exist.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AdminInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    private static final String ADMIN_USERNAME = System.getenv("ADMIN_USERNAME") != null
            ? System.getenv("ADMIN_USERNAME") : "admin";
    private static final String ADMIN_EMAIL = System.getenv("ADMIN_EMAIL") != null
            ? System.getenv("ADMIN_EMAIL") : "admin@poliwise.local";
    private static final String ADMIN_PASSWORD = System.getenv("ADMIN_PASSWORD") != null
            ? System.getenv("ADMIN_PASSWORD") : "changeme";
    private static final UserRole ADMIN_ROLE = UserRole.ADMIN;

    @Override
    @Transactional
    public void run(String... args) {
        if (userRepository.existsByUsernameIgnoreCase(ADMIN_USERNAME)) {
            log.info("Admin account '{}' already exists, skipping initialization.", ADMIN_USERNAME);
            return;
        }

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        User admin = User.builder()
                .id(UUID.randomUUID())
                .username(ADMIN_USERNAME.toLowerCase())
                .email(ADMIN_EMAIL.toLowerCase())
                .passwordHash(passwordEncoder.encode(ADMIN_PASSWORD))
                .role(ADMIN_ROLE)
                .status(AccountStatus.ACTIVE)
                .failedLoginAttempts(0)
                .mustChangePassword(false)
                .passwordChangedAt(now)
                .createdAt(now)
                .updatedAt(now)
                .build();

        userRepository.save(admin);
        log.info("Admin account '{}' created successfully.", ADMIN_USERNAME);
    }
}
