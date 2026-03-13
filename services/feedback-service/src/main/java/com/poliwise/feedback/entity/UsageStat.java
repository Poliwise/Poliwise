package com.poliwise.feedback.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "usage_stats", schema = "analytics")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UsageStat {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "user_role")
    private String userRole;

    @Column(name = "user_department_id")
    private UUID userDepartmentId;

    @Column(name = "service_name")
    private String serviceName;

    @Column(name = "endpoint")
    private String endpoint;

    @Column(name = "method")
    private String method;

    @Column(name = "response_time_ms")
    private Integer responseTimeMs;

    @Column(name = "status_code")
    private Integer statusCode;

    @Column(name = "request_size_bytes")
    private Integer requestSizeBytes;

    @Column(name = "response_size_bytes")
    private Integer responseSizeBytes;

    @Column(name = "is_error")
    private Boolean isError;

    @Column(name = "error_code")
    private String errorCode;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @Column(name = "tokens_used")
    private Integer tokensUsed;

    @Column(name = "model_used")
    private String modelUsed;

    @Column(name = "chunks_retrieved")
    private Integer chunksRetrieved;

    @Column(name = "confidence")
    private String confidence;

    @Column(name = "trace_id")
    private String traceId;

    @Column(name = "ip_address", columnDefinition = "inet")
    private String ipAddress;

    @Column(name = "user_agent", columnDefinition = "text")
    private String userAgent;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;


    /* ===== Helper methods cho analytics ===== */

    public boolean isSuccess() {
        return !Boolean.TRUE.equals(isError) && statusCode != null && statusCode < 400;
    }

    public boolean isSlowRequest() {
        return responseTimeMs != null && responseTimeMs > 2000;
    }
}
