package com.poliwise.feedback.entity;

import com.poliwise.feedback.enums.AuditAction;
import com.poliwise.feedback.enums.ResourceType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "audit_logs", schema = "analytics")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "username")
    private String username;

    @Column(name = "user_role")
    private String userRole;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", columnDefinition = "analytics.audit_action")
    private AuditAction action;

    @Enumerated(EnumType.STRING)
    @Column(name = "resource_type", columnDefinition = "analytics.resource_type")
    private ResourceType resourceType;

    @Column(name = "resource_id")
    private UUID resourceId;

    @Column(name = "resource_name")
    private String resourceName;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "old_value", columnDefinition = "jsonb")
    private Map<String, Object> oldValue;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "new_value", columnDefinition = "jsonb")
    private Map<String, Object> newValue;

    @Column(name = "changed_fields")
    private List<String> changedFields;

    @Column(name = "ip_address", columnDefinition = "inet")
    private String ipAddress;

    @Column(name = "user_agent", columnDefinition = "text")
    private String userAgent;

    @Column(name = "trace_id")
    private String traceId;

    @Column(name = "service_name")
    private String serviceName;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;


    /* ===== Helper methods ===== */

    public boolean isUserAction() {
        return resourceType == ResourceType.USER;
    }

    public boolean isDocumentAction() {
        return resourceType == ResourceType.DOCUMENT;
    }
}
