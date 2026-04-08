package com.poliwise.feedback.controller;

import com.poliwise.feedback.dto.request.AnalyticsRequest;
import com.poliwise.feedback.dto.response.*;
import com.poliwise.feedback.service.AnalyticsService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<AnalyticsSummaryResponse>> getSummary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) UUID departmentId) {
        return ResponseEntity.ok(ApiResponse.success(analyticsService.getSummary(new AnalyticsRequest(fromDate, toDate, departmentId))));
    }

    @GetMapping("/questions")
    public ResponseEntity<ApiResponse<List<PopularQuestionResponse>>> getTopQuestions(
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.success(analyticsService.getTopQuestions(limit, from, to)));
    }

    @GetMapping("/documents")
    public ResponseEntity<ApiResponse<List<DocumentPopularityResponse>>> getTopDocuments(
            @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(ApiResponse.success(analyticsService.getTopDocuments(limit)));
    }

    @GetMapping("/feedback")
    public ResponseEntity<ApiResponse<AnalyticsSummaryResponse>> getFeedbackAnalysis(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate) {
        return ResponseEntity.ok(ApiResponse.success(analyticsService.getSummary(new AnalyticsRequest(fromDate, toDate, null))));
    }

    @GetMapping("/departments/{deptId}")
    public ResponseEntity<ApiResponse<DepartmentStatsResponse>> getDepartmentStats(
            @PathVariable UUID deptId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        LocalDate targetDate = date != null ? date : LocalDate.now();
        return ResponseEntity.ok(ApiResponse.success(analyticsService.getDepartmentStats(deptId, targetDate)));
    }

    @GetMapping("/trends")
    public ResponseEntity<ApiResponse<List<TrendResponse>>> getTrends(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(ApiResponse.success(analyticsService.getTrends(days)));
    }
}
