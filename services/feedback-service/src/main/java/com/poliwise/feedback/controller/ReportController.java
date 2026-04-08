package com.poliwise.feedback.controller;

import com.poliwise.feedback.dto.request.ReportExportRequest;
import com.poliwise.feedback.dto.response.ApiResponse;
import com.poliwise.feedback.dto.response.ReportExportResponse;
import com.poliwise.feedback.security.JwtAuthenticationToken;
import com.poliwise.feedback.security.UserPrincipal;
import com.poliwise.feedback.service.ReportExportService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reports")
public class ReportController {

    private final ReportExportService reportExportService;

    public ReportController(ReportExportService reportExportService) {
        this.reportExportService = reportExportService;
    }

    @PostMapping("/export")
    public ResponseEntity<ApiResponse<ReportExportResponse>> createReport(
            @Valid @RequestBody ReportExportRequest request, Authentication authentication) {
        UUID userId = getUserId(authentication);
        return ResponseEntity.accepted().body(ApiResponse.success(reportExportService.createReport(userId, request), "Report generation started"));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ReportExportResponse>> getStatus(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(reportExportService.getReportStatus(id)));
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> download(@PathVariable UUID id, Authentication authentication) {
        UUID userId = getUserId(authentication);
        boolean isAdmin = "ADMIN".equals(getRole(authentication));
        byte[] data = reportExportService.downloadReport(id, userId, isAdmin);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"report-" + id + ".csv\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM).body(data);
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Page<ReportExportResponse>>> getMyReports(
            Authentication authentication, @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(reportExportService.getReportsByUser(getUserId(authentication), pageable)));
    }

    private UUID getUserId(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwtAuth) return ((UserPrincipal) jwtAuth.getPrincipal()).getUserId();
        throw new IllegalStateException("Invalid authentication type");
    }

    private String getRole(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwtAuth) return ((UserPrincipal) jwtAuth.getPrincipal()).getRole();
        return null;
    }
}
