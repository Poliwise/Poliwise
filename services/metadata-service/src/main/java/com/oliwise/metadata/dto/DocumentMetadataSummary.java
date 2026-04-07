package com.poliwise.metadata.dto;

import com.poliwise.metadata.entity.DocumentMetadata;
import com.poliwise.metadata.enums.AccessLevel;
import com.poliwise.metadata.enums.DocumentStatus;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record DocumentMetadataSummary(
        UUID id,
        UUID documentId,
        String title,
        String documentType,
        String categoryName,
        AccessLevel accessLevel,
        LocalDate effectiveDate,
        LocalDate expiryDate,
        DocumentStatus status,
        Integer currentVersion,
        List<String> tagNames,
        OffsetDateTime updatedAt
) {
    public static DocumentMetadataSummary from(DocumentMetadata dm, String categoryName, List<String> tagNames) {
        return new DocumentMetadataSummary(
                dm.getId(), dm.getDocumentId(), dm.getTitle(), dm.getDocumentType(),
                categoryName, dm.getAccessLevel(), dm.getEffectiveDate(),
                dm.getExpiryDate(), dm.getStatus(), dm.getCurrentVersion(),
                tagNames, dm.getUpdatedAt()
        );
    }
}