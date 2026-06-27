package com.poliwise.feedback.controller;

import com.poliwise.feedback.dto.request.AppealRequest;
import com.poliwise.feedback.dto.request.ReviewViolationRequest;
import com.poliwise.feedback.dto.response.ApiResponse;
import com.poliwise.feedback.entity.Violation;
import com.poliwise.feedback.entity.Warning;
import com.poliwise.feedback.enums.AppealStatus;
import com.poliwise.feedback.security.JwtAuthenticationToken;
import com.poliwise.feedback.security.UserPrincipal;
import com.poliwise.feedback.service.ViolationService;
import com.poliwise.feedback.service.WarningService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/violations")
public class ViolationController {

    private final ViolationService violationService;
    private final WarningService warningService;

    public ViolationController(ViolationService violationService, WarningService warningService) {
        this.violationService = violationService;
        this.warningService = warningService;
    }

    // ─── USER ENDPOINTS ─────────────────────────────────────────────────────────

    /**
     * Get my violation history.
     */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<Page<Violation>>> getMyViolations(
            Authentication authentication,
            @PageableDefault(size = 20) Pageable pageable) {
        UUID userId = getUserId(authentication);
        Page<Violation> violations = violationService.getUserViolations(userId, pageable);
        return ResponseEntity.ok(ApiResponse.success(violations));
    }

    /**
     * Submit an appeal for a violation.
     */
    @PostMapping("/{id}/appeal")
    public ResponseEntity<ApiResponse<Violation>> submitAppeal(
            @PathVariable UUID id,
            @Valid @RequestBody AppealRequest request,
            Authentication authentication) {
        UUID userId = getUserId(authentication);
        Violation violation = violationService.submitAppeal(id, request, userId);
        return ResponseEntity.ok(ApiResponse.success(violation, "Appeal submitted successfully"));
    }

    /**
     * Get my unread warnings.
     */
    @GetMapping("/me/warnings")
    public ResponseEntity<ApiResponse<Page<Warning>>> getMyWarnings(
            Authentication authentication,
            @PageableDefault(size = 20) Pageable pageable) {
        UUID userId = getUserId(authentication);
        Page<Warning> warnings = warningService.getUnreadWarnings(userId, pageable);
        return ResponseEntity.ok(ApiResponse.success(warnings));
    }

    /**
     * Acknowledge a warning (mark as read).
     */
    @PostMapping("/warnings/{id}/acknowledge")
    public ResponseEntity<ApiResponse<Warning>> acknowledgeWarning(
            @PathVariable UUID id,
            Authentication authentication) {
        UUID userId = getUserId(authentication);
        Warning warning = warningService.acknowledgeWarning(id, userId);
        return ResponseEntity.ok(ApiResponse.success(warning, "Warning acknowledged"));
    }

    // ─── ADMIN ENDPOINTS ───────────────────────────────────────────────────────

    /**
     * Get the admin review queue (pending violations).
     */
    @GetMapping("/queue")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Page<Violation>>> getViolationQueue(
            @PageableDefault(size = 20) Pageable pageable) {
        Page<Violation> violations = violationService.getPendingViolations(pageable);
        return ResponseEntity.ok(ApiResponse.success(violations));
    }

    /**
     * Get violations for a specific user.
     */
    @GetMapping("/users/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Page<Violation>>> getUserViolations(
            @PathVariable UUID userId,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<Violation> violations = violationService.getUserViolations(userId, pageable);
        return ResponseEntity.ok(ApiResponse.success(violations));
    }

    /**
     * Review a violation and take action.
     */
    @PostMapping("/{id}/review")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Violation>> reviewViolation(
            @PathVariable UUID id,
            @Valid @RequestBody ReviewViolationRequest request,
            Authentication authentication) {
        UUID adminId = getUserId(authentication);
        Violation violation = violationService.reviewViolation(id, request, adminId);
        return ResponseEntity.ok(ApiResponse.success(violation, "Violation reviewed successfully"));
    }

    /**
     * Get pending appeals.
     */
    @GetMapping("/appeals")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Page<Violation>>> getAppeals(
            @RequestParam(defaultValue = "PENDING") AppealStatus status,
            @PageableDefault(size = 20) Pageable pageable) {
        // Get all violations with the specified appeal status
        Page<Violation> violations = violationService.getAppeals(status, pageable);
        return ResponseEntity.ok(ApiResponse.success(violations));
    }

    /**
     * Review an appeal.
     */
    @PostMapping("/appeals/{id}/review")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Violation>> reviewAppeal(
            @PathVariable UUID id,
            @RequestParam boolean approved,
            Authentication authentication) {
        UUID adminId = getUserId(authentication);
        Violation violation = violationService.reviewAppeal(id, approved, adminId);
        String message = approved ? "Appeal approved" : "Appeal rejected";
        return ResponseEntity.ok(ApiResponse.success(violation, message));
    }

    /**
     * Reset strike count for a user.
     */
    @PostMapping("/users/{userId}/reset-strikes")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> resetStrikes(
            @PathVariable UUID userId,
            Authentication authentication) {
        UUID adminId = getUserId(authentication);
        violationService.resetStrikes(userId, adminId);
        return ResponseEntity.ok(ApiResponse.success(null, "Strike count reset successfully"));
    }

    /**
     * Get violation statistics.
     */
    @GetMapping("/stats")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getViolationStats() {
        long pendingCount = violationService.countPendingViolations();
        long totalCount = violationService.countTotalViolations();
        long pendingAppealsCount = violationService.countPendingAppeals();
        long warningsCount = warningService.countTotalWarnings();
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "pendingViolations", pendingCount,
                "totalViolations", totalCount,
                "pendingAppeals", pendingAppealsCount,
                "totalWarnings", warningsCount
        )));
    }

    private UUID getUserId(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwtAuth) {
            return ((UserPrincipal) jwtAuth.getPrincipal()).getUserId();
        }
        throw new IllegalStateException("Invalid authentication type");
    }
}
