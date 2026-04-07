package com.poliwise.metadata.dto;

import com.poliwise.metadata.entity.DocumentAccessRule;
import com.poliwise.metadata.enums.UserRole;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AccessRuleResponse(
        UUID id,
        UUID documentMetadataId,
        String targetType,
        UserRole targetRole,
        UUID targetDepartmentId,
        UUID targetUserId,
        String permission,
        UUID createdBy,
        OffsetDateTime createdAt
) {
    public static AccessRuleResponse from(DocumentAccessRule rule) {
        return new AccessRuleResponse(
                rule.getId(), rule.getDocumentMetadataId(), rule.getTargetType(),
                rule.getTargetRole(), rule.getTargetDepartmentId(), rule.getTargetUserId(),
                rule.getPermission(), rule.getCreatedBy(), rule.getCreatedAt()
        );
    }
}