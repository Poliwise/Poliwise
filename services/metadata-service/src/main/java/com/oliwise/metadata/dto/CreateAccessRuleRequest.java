package com.poliwise.metadata.dto;

import com.poliwise.metadata.enums.UserRole;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CreateAccessRuleRequest(
        @NotNull(message = "documentMetadataId is required") UUID documentMetadataId,
        @NotNull(message = "targetType is required") String targetType,
        String targetRole,
        UUID targetDepartmentId,
        UUID targetUserId,
        String permission
) {}