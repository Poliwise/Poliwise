package com.poliwise.metadata.dto;

import com.poliwise.metadata.enums.AccessLevel;
import com.poliwise.metadata.enums.DocumentStatus;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record UpdateDocumentMetadataRequest(
        String title,
        String description,
        String documentType,
        UUID categoryId,
        UUID departmentId,
        AccessLevel accessLevel,
        LocalDate effectiveDate,
        LocalDate expiryDate,
        DocumentStatus status,
        List<UUID> tagIds
) {}