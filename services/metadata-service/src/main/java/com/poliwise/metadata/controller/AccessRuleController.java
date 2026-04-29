package com.poliwise.metadata.controller;

import com.poliwise.metadata.dto.AccessRuleResponse;
import com.poliwise.metadata.dto.CreateAccessRuleRequest;
import com.poliwise.metadata.security.SecurityUtils;
import com.poliwise.metadata.service.AccessRuleService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/access-rules")
public class AccessRuleController {

    private final AccessRuleService accessRuleService;

    public AccessRuleController(AccessRuleService accessRuleService) {
        this.accessRuleService = accessRuleService;
    }

    /**
     * Get access rules by metadata ID.
     * Frontend calls: GET /api/v1/access-rules?metadataId=...
     */
    @GetMapping
    public ResponseEntity<List<AccessRuleResponse>> getByMetadataId(
            @RequestParam("metadataId") UUID metadataId) {
        List<AccessRuleResponse> rules = accessRuleService.getByMetadataId(metadataId);
        return ResponseEntity.ok(rules);
    }

    /**
     * Get all access rules (admin only).
     */
    @GetMapping("/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<AccessRuleResponse>> getAll() {
        List<AccessRuleResponse> rules = accessRuleService.getAll();
        return ResponseEntity.ok(rules);
    }

    /**
     * Create a new access rule.
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AccessRuleResponse> create(
            @Valid @RequestBody CreateAccessRuleRequest request) {
        UUID createdBy = SecurityUtils.getCurrentUserId();
        AccessRuleResponse response = accessRuleService.create(
                request.metadataId(), request, createdBy);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Delete an access rule.
     */
    @DeleteMapping("/{ruleId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID ruleId) {
        accessRuleService.delete(ruleId);
        return ResponseEntity.noContent().build();
    }
}
