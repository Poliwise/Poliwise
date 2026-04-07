package com.poliwise.metadata.dto;

import com.poliwise.metadata.entity.Category;

import java.time.OffsetDateTime;
import java.util.UUID;

public record CategoryResponse(
        UUID id,
        String name,
        String slug,
        String description,
        UUID parentId,
        String parentName,
        String icon,
        Integer displayOrder,
        Boolean isActive,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public static CategoryResponse from(Category c, String parentName) {
        return new CategoryResponse(
                c.getId(), c.getName(), c.getSlug(), c.getDescription(),
                c.getParentId(), parentName, c.getIcon(), c.getDisplayOrder(),
                c.getIsActive(), c.getCreatedAt(), c.getUpdatedAt()
        );
    }
}