package com.poliwise.metadata.entity;

import com.poliwise.metadata.enums.UserRole;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "document_access_rules", schema = "metadata")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentAccessRule {
    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "document_metadata_id", nullable = false)
    private UUID documentMetadataId;

    @Column(name = "target_type")
    private String targetType;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_role", columnDefinition = "core.user_role")
    private UserRole targetRole;

    @Column(name = "target_department_id")
    private UUID targetDepartmentId;

    @Column(name = "target_user_id")
    private UUID targetUserId;

    @Column(name = "permission")
    private String permission;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;
}
