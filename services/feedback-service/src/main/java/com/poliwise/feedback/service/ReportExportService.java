package com.poliwise.feedback.service;

import com.poliwise.feedback.dto.request.ReportExportRequest;
import com.poliwise.feedback.dto.response.ReportExportResponse;
import com.poliwise.feedback.entity.ReportExport;
import com.poliwise.feedback.enums.ExportFormat;
import com.poliwise.feedback.enums.ExportStatus;
import com.poliwise.feedback.exception.ReportNotFoundException;
import com.poliwise.feedback.exception.UnauthorizedFeedbackAccessException;
import com.poliwise.feedback.repository.ReportExportRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class ReportExportService {

    private static final Logger log = LoggerFactory.getLogger(ReportExportService.class);
    private final ReportExportRepository reportExportRepository;
    private final AnalyticsService analyticsService;

    @Value("${poliwise.cleanup.report-expiry-days:7}")
    private int reportExpiryDays;

    public ReportExportService(ReportExportRepository reportExportRepository, AnalyticsService analyticsService) {
        this.reportExportRepository = reportExportRepository;
        this.analyticsService = analyticsService;
    }

    public ReportExportResponse createReport(UUID requestedBy, ReportExportRequest request) {
        ReportExport report = ReportExport.builder()
                .reportType(request.reportType()).title(request.title())
                .format(request.format()).departmentId(request.departmentId())
                .status(ExportStatus.PENDING.name()).requestedBy(requestedBy)
                .build();
        if (request.dateFrom() != null) {
            report.setDateFrom(request.dateFrom());
        }
        if (request.dateTo() != null) {
            report.setDateTo(request.dateTo());
        }
        ReportExport saved = reportExportRepository.save(report);
        generateReportAsync(saved.getId());
        return ReportExportResponse.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public ReportExportResponse getReportStatus(UUID id) {
        return reportExportRepository.findById(id)
                .map(ReportExportResponse::fromEntity)
                .orElseThrow(() -> new ReportNotFoundException(id));
    }

    @Transactional(readOnly = true)
    public byte[] downloadReport(UUID id, UUID userId, boolean isAdmin) {
        ReportExport report = reportExportRepository.findById(id)
                .orElseThrow(() -> new ReportNotFoundException(id));
        if (!isAdmin && !report.getRequestedBy().equals(userId)) {
            throw new UnauthorizedFeedbackAccessException();
        }
        if (!ExportStatus.COMPLETED.name().equals(report.getStatus())) {
            throw new IllegalStateException("Report not ready: " + report.getStatus());
        }
        return generateReportData(report);
    }

    @Async("reportExportExecutor")
    public void generateReportAsync(UUID reportId) {
        try { generateReport(reportId); }
        catch (Exception e) { log.error("Failed to generate report: {}", reportId, e); markReportFailed(reportId, e.getMessage()); }
    }

    @Transactional
    public void generateReport(UUID id) {
        ReportExport report = reportExportRepository.findById(id).orElse(null);
        if (report == null) return;
        report.setStatus(ExportStatus.PROCESSING.name());
        reportExportRepository.save(report);
        try {
            byte[] data = generateReportData(report);
            report.setFileSizeBytes(data.length);
            report.setFileKey("reports/" + id + "." + report.getFormat().name().toLowerCase());
            report.setStatus(ExportStatus.COMPLETED.name());
            report.setCompletedAt(Instant.now());
            report.setExpiresAt(Instant.now().plus(reportExpiryDays, ChronoUnit.DAYS));
        } catch (Exception e) {
            report.setStatus(ExportStatus.FAILED.name());
            report.setErrorMessage(e.getMessage());
            log.error("Report generation failed: {}", id, e);
        }
        reportExportRepository.save(report);
    }

    private byte[] generateReportData(ReportExport report) {
        ExportFormat format = report.getFormat();
        String content = switch (format) {
            case CSV -> generateCsvReport(report);
            case JSON -> generateJsonReport(report);
            default -> generateCsvReport(report);
        };
        return content.getBytes();
    }

    private String generateCsvReport(ReportExport report) {
        return "Report Type,Title,Status,Requested By,Created At,Completed At\n" +
                report.getReportType() + "," +
                "\"" + report.getTitle() + "\"," +
                report.getStatus() + "," +
                report.getRequestedBy() + "," +
                report.getCreatedAt() + "," +
                report.getCompletedAt() + "\n";
    }

    private String generateJsonReport(ReportExport report) {
        return String.format("{\"id\":\"%s\",\"type\":\"%s\",\"title\":\"%s\",\"status\":\"%s\",\"createdAt\":\"%s\"}",
                report.getId(), report.getReportType(), report.getTitle(), report.getStatus(), report.getCreatedAt());
    }

    private void markReportFailed(UUID id, String error) {
        reportExportRepository.findById(id).ifPresent(report -> {
            report.setStatus(ExportStatus.FAILED.name());
            report.setErrorMessage(error);
            reportExportRepository.save(report);
        });
    }

    @Scheduled(cron = "0 0 1 * * *")
    @Transactional
    public void deleteExpiredReports() {
        List<ReportExport> expired = reportExportRepository.findExpiredReports(Instant.now());
        reportExportRepository.deleteAll(expired);
        if (!expired.isEmpty()) log.info("Deleted {} expired reports", expired.size());
    }

    @Transactional(readOnly = true)
    public Page<ReportExportResponse> getReportsByUser(UUID userId, Pageable pageable) {
        return reportExportRepository.findByRequestedBy(userId, pageable).map(ReportExportResponse::fromEntity);
    }
}
