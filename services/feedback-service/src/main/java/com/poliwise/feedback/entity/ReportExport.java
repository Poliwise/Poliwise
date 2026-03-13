package com.poliwise.feedback.entity;

import com.poliwise.feedback.enums.ExportFormat;
import com.poliwise.feedback.enums.ReportType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "report_exports", schema = "analytics")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReportExport {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "report_type", columnDefinition = "analytics.report_type")
    private ReportType reportType;

    @Column(name = "title")
    private String title;

    @Column(name = "date_from")
    private LocalDate dateFrom;

    @Column(name = "date_to")
    private LocalDate dateTo;

    @Column(name = "department_id")
    private UUID departmentId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "filters", columnDefinition = "jsonb")
    private Map<String, Object> filters;

    @Enumerated(EnumType.STRING)
    @Column(name = "format", columnDefinition = "analytics.export_format")
    private ExportFormat format;

    @Column(name = "file_key")
    private String fileKey;

    @Column(name = "file_size_bytes")
    private Integer fileSizeBytes;

    @Column(name = "status")
    private String status;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @Column(name = "requested_by")
    private UUID requestedBy;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @Column(name = "downloaded_at")
    private OffsetDateTime downloadedAt;

    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;


    /* ===== Helper methods ===== */

    public boolean isCompleted() {
        return "COMPLETED".equalsIgnoreCase(status);
    }

    public boolean isFailed() {
        return "FAILED".equalsIgnoreCase(status);
    }

    public boolean isExpired() {
        return expiresAt != null && expiresAt.isBefore(OffsetDateTime.now());
    }
}
