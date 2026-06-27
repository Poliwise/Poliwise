package com.poliwise.feedback.service;

import com.poliwise.feedback.dto.request.AppealRequest;
import com.poliwise.feedback.dto.request.ReviewViolationRequest;
import com.poliwise.feedback.entity.Violation;
import com.poliwise.feedback.entity.Warning;
import com.poliwise.feedback.enums.*;
import com.poliwise.feedback.repository.ViolationRepository;
import com.poliwise.feedback.repository.WarningRepository;
import com.poliwise.feedback.feign.UserServiceClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ViolationService {

    private final ViolationRepository violationRepository;
    private final WarningRepository warningRepository;
    private final UserServiceClient userServiceClient;
    private final EscalationChecker escalationChecker;

    @Value("${violation.logging.store-evidence:true}")
    private boolean storeEvidence;

    @Transactional
    public Violation logViolation(
            UUID userId,
            ViolationType violationType,
            ViolationSeverity severity,
            String evidence,
            String source,
            UUID userDepartmentId,
            String userRole
    ) {
        // Admins are exempt from violation logging
        if ("ADMIN".equals(userRole)) {
            log.info("Admin violation logged but exempt from escalation: userId={}", userId);
            return null;
        }

        Violation violation = Violation.builder()
                .userId(userId)
                .violationType(violationType)
                .severity(severity)
                .evidence(storeEvidence ? evidence : null)
                .source(source)
                .status(ViolationStatus.PENDING)
                .userDepartmentId(userDepartmentId)
                .userRole(userRole)
                .build();

        violation = violationRepository.save(violation);
        log.info("Violation logged: id={}, userId={}, type={}", violation.getId(), userId, violationType);

        // Increment strike count in user-service
        try {
            userServiceClient.incrementStrikeCount(userId.toString());
        } catch (Exception e) {
            log.error("Failed to increment strike count for user {}", userId, e);
        }

        // Evaluate escalation
        escalationChecker.evaluate(userId);

        return violation;
    }

    public Page<Violation> getUserViolations(UUID userId, Pageable pageable) {
        return violationRepository.findByUserIdAndDeletedAtIsNull(userId, pageable);
    }

    public Page<Violation> getPendingViolations(Pageable pageable) {
        return violationRepository.findByStatusAndDeletedAtIsNull(ViolationStatus.PENDING, pageable);
    }

    public Page<UUID> getUsersWithPendingViolations(Pageable pageable) {
        return violationRepository.findDistinctUserIdsWithStatus(ViolationStatus.PENDING, pageable);
    }

    public long countPendingViolations() {
        return violationRepository.countByStatus(ViolationStatus.PENDING);
    }

    public Page<Violation> getAppeals(AppealStatus status, Pageable pageable) {
        return violationRepository.findByAppealStatus(status, pageable);
    }

    public long countTotalViolations() {
        return violationRepository.countTotalViolations();
    }

    public long countPendingAppeals() {
        return violationRepository.countByAppealStatus(AppealStatus.PENDING);
    }

    @Transactional
    public Violation reviewViolation(UUID violationId, ReviewViolationRequest request, UUID reviewedBy) {
        Violation violation = violationRepository.findByIdAndDeletedAtIsNull(violationId)
                .orElseThrow(() -> new IllegalArgumentException("Violation not found: " + violationId));

        violation.setStatus(ViolationStatus.REVIEWED);
        violation.setActionTaken(request.action());
        violation.setReviewedAt(Instant.now());
        violation.setReviewedBy(reviewedBy);

        // Handle action
        switch (request.action()) {
            case DISMISSED:
                // Dismissed: decrement strike count
                try {
                    userServiceClient.decrementStrikeCount(violation.getUserId().toString(), 1);
                } catch (Exception e) {
                    log.error("Failed to decrement strike count", e);
                }
                break;
            case WARNED:
                // Already warned via escalation, just mark reviewed
                break;
            case DEACTIVATED:
                try {
                    userServiceClient.changeUserStatus(violation.getUserId().toString(), "DEACTIVATED");
                } catch (Exception e) {
                    log.error("Failed to deactivate user", e);
                }
                break;
            case REVOKED:
                try {
                    userServiceClient.changeUserStatus(violation.getUserId().toString(), "REVOKED");
                } catch (Exception e) {
                    log.error("Failed to revoke user", e);
                }
                break;
        }

        violation.setStatus(ViolationStatus.ACTIONED);
        return violationRepository.save(violation);
    }

    @Transactional
    public Violation submitAppeal(UUID violationId, AppealRequest request, UUID userId) {
        Violation violation = violationRepository.findByIdAndDeletedAtIsNull(violationId)
                .orElseThrow(() -> new IllegalArgumentException("Violation not found: " + violationId));

        // Users can only appeal their own violations
        if (!violation.getUserId().equals(userId)) {
            throw new IllegalArgumentException("Cannot appeal another user's violation");
        }

        violation.setAppealStatus(AppealStatus.PENDING);
        violation.setAppealText(request.appealText());
        return violationRepository.save(violation);
    }

    @Transactional
    public Violation reviewAppeal(UUID violationId, boolean approved, UUID reviewedBy) {
        Violation violation = violationRepository.findByIdAndDeletedAtIsNull(violationId)
                .orElseThrow(() -> new IllegalArgumentException("Violation not found: " + violationId));

        if (violation.getAppealStatus() != AppealStatus.PENDING) {
            throw new IllegalArgumentException("Appeal already reviewed");
        }

        violation.setAppealStatus(approved ? AppealStatus.APPROVED : AppealStatus.REJECTED);
        violation.setAppealReviewedAt(Instant.now());
        violation.setAppealReviewedBy(reviewedBy);

        if (approved) {
            // Clear the violation: soft delete and decrement strike count
            violation.setDeletedAt(Instant.now());
            try {
                userServiceClient.decrementStrikeCount(violation.getUserId().toString(), 1);
            } catch (Exception e) {
                log.error("Failed to decrement strike count on appeal approval", e);
            }
        }

        return violationRepository.save(violation);
    }

    @Transactional
    public void resetStrikes(UUID userId, UUID adminId) {
        try {
            userServiceClient.resetStrikeCount(userId.toString());
            log.info("Strikes reset for user {} by admin {}", userId, adminId);
        } catch (Exception e) {
            log.error("Failed to reset strikes for user {}", userId, e);
            throw new RuntimeException("Failed to reset strikes", e);
        }
    }
}
