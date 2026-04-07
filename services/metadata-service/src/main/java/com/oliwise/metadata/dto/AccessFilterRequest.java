package com.poliwise.metadata.dto;

import com.poliwise.metadata.enums.UserRole;

import java.util.UUID;

public record AccessFilterRequest(
        UUID userId,
        UserRole role,
        UUID departmentId,
        java.util.List<UUID> documentIds
) {}