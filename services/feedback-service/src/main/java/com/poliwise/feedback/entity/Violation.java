package com.poliwise.feedback.entity;

import com.poliwise.feedback.enums.*;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "user_violations", schema = "analytics",
       indexes = {
           @Index(name = "idx_violations_user", columnList = "user_id"),
           @Index(name = "idx_violations_status", columnList = "status")
       })
public class Violation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "violation_type", nullable = false)
    private ViolationType violationType;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "severity", nullable = false)
    private ViolationSeverity severity;

    @Column(name = "evidence", columnDefinition = "TEXT")
    private String evidence;

    @Column(name = "source", nullable = false)
    private String source;

    @Column(name = "reported_by")
    private UUID reportedBy;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "status", nullable = false)
    private ViolationStatus status;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "action_taken")
    private ViolationAction actionTaken;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "reviewed_by")
    private UUID reviewedBy;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "appeal_status")
    private AppealStatus appealStatus;

    @Column(name = "appeal_text", columnDefinition = "TEXT")
    private String appealText;

    @Column(name = "appeal_reviewed_at")
    private Instant appealReviewedAt;

    @Column(name = "appeal_reviewed_by")
    private UUID appealReviewedBy;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "user_department_id")
    private UUID userDepartmentId;

    @Column(name = "user_role", length = 20)
    private String userRole;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (status == null) {
            status = ViolationStatus.PENDING;
        }
    }
}
