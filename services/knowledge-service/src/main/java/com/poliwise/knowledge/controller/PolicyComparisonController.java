package com.poliwise.knowledge.controller;

import com.poliwise.knowledge.dto.PolicyComparisonResponse;
import com.poliwise.knowledge.security.SecurityUtils;
import com.poliwise.knowledge.service.PolicyComparisonService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/documents")
public class PolicyComparisonController {

    private final PolicyComparisonService comparisonService;

    public PolicyComparisonController(PolicyComparisonService comparisonService) {
        this.comparisonService = comparisonService;
    }

    @PostMapping("/compare")
    @PreAuthorize("hasRole('ADMIN') or hasRole('MANAGER')")
    public ResponseEntity<PolicyComparisonResponse> compare(
            @RequestParam UUID document1Id,
            @RequestParam UUID document2Id) {

        PolicyComparisonResponse result = comparisonService.compare(document1Id, document2Id);
        return ResponseEntity.ok(result);
    }
}