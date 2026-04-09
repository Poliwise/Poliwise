package com.poliwise.feedback.controller;

import com.poliwise.feedback.dto.request.AuditLogSearchRequest;
import com.poliwise.feedback.dto.response.ApiResponse;
import com.poliwise.feedback.dto.response.AuditLogResponse;
import com.poliwise.feedback.service.AuditLogService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/audit-logs")
public class AuditController {

    private final AuditLogService auditLogService;

    public AuditController(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Page<AuditLogResponse>>> search(
            AuditLogSearchRequest request, @PageableDefault(size = 50) Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(auditLogService.searchLogs(request, pageable)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AuditLogResponse>> getById(@PathVariable UUID id) {
        AuditLogResponse log = auditLogService.getAuditLogById(id);
        if (log == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(ApiResponse.success(log));
    }
}
