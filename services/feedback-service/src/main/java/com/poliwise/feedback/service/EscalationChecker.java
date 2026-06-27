package com.poliwise.feedback.service;

import com.poliwise.feedback.entity.Warning;
import com.poliwise.feedback.feign.UserServiceClient;
import com.poliwise.feedback.repository.WarningRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class EscalationChecker {

    private final WarningRepository warningRepository;
    private final UserServiceClient userServiceClient;

    @Value("${violation.strike.warn-threshold:3}")
    private int warnThreshold;

    @Value("${violation.strike.deactivate-threshold:5}")
    private int deactivateThreshold;

    @Value("${violation.strike.revoke-threshold:10}")
    private int revokeThreshold;

    @Value("${violation.escalation.auto-warn:true}")
    private boolean autoWarn;

    @Value("${violation.escalation.auto-deactivate:true}")
    private boolean autoDeactivate;

    @Value("${violation.escalation.auto-revoke:true}")
    private boolean autoRevoke;

    @Value("${violation.warning.expiry-days:30}")
    private int warningExpiryDays;

    /**
     * Evaluate escalation thresholds for a user based on their strike count.
     * Admins are exempt from all escalation actions.
     *
     * @param userId The user ID to evaluate
     */
    public void evaluate(UUID userId) {
        try {
            int strikeCount = userServiceClient.getStrikeCount(userId.toString());
            evaluateThresholds(userId, strikeCount);
        } catch (Exception e) {
            log.error("Failed to evaluate escalation for user {}", userId, e);
        }
    }

    private void evaluateThresholds(UUID userId, int strikeCount) {
        String userIdStr = userId.toString();
        
        // Revoke threshold (highest priority)
        if (autoRevoke && strikeCount >= revokeThreshold) {
            try {
                userServiceClient.changeUserStatus(userIdStr, "REVOKED");
                log.warn("User {} auto-revoked: strikeCount={}", userId, strikeCount);
            } catch (Exception e) {
                log.error("Failed to auto-revoke user {}", userId, e);
            }
            return;
        }

        // Deactivate threshold
        if (autoDeactivate && strikeCount >= deactivateThreshold) {
            try {
                userServiceClient.changeUserStatus(userIdStr, "DEACTIVATED");
                log.warn("User {} auto-deactivated: strikeCount={}", userId, strikeCount);
            } catch (Exception e) {
                log.error("Failed to auto-deactivate user {}", userId, e);
            }
            return;
        }

        // Warn threshold
        if (autoWarn && strikeCount >= warnThreshold) {
            // Check if user already has an active warning
            List<Warning> existingWarnings = warningRepository.findByUserIdAndReadAtIsNullAndExpiresAtAfter(
                    userId, Instant.now());
            
            if (existingWarnings.isEmpty()) {
                try {
                    sendWarning(userId, strikeCount);
                } catch (Exception e) {
                    log.error("Failed to send warning to user {}", userId, e);
                }
            }
        }
    }

    @Transactional
    public Warning sendWarning(UUID userId, int strikeCount) {
        String message = String.format(
                "Your account has received a warning due to policy violations (currently %d strike(s)). " +
                "Further violations may result in account suspension or permanent revocation.",
                strikeCount
        );

        Warning warning = Warning.builder()
                .userId(userId)
                .message(message)
                .expiresAt(Instant.now().plus(warningExpiryDays, ChronoUnit.DAYS))
                .build();

        warning = warningRepository.save(warning);
        log.info("Warning sent to user {}: strikeCount={}", userId, strikeCount);
        return warning;
    }
}
