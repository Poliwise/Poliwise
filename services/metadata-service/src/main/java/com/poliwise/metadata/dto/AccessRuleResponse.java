package com.poliwise.metadata.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AccessRuleResponse(
        UUID id,
        UUID documentMetadataId,
        String targetType,
        String targetRole,
        UUID targetDepartmentId,
        UUID targetUserId,
        String permission,
        UUID createdBy,
        OffsetDateTime createdAt
) {}