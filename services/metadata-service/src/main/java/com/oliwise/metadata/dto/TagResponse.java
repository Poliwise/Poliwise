package com.poliwise.metadata.dto;

import com.poliwise.metadata.entity.Tag;

import java.util.UUID;

public record TagResponse(
        UUID id,
        String name,
        String slug,
        String color,
        Integer usageCount,
        java.time.OffsetDateTime createdAt
) {
    public static TagResponse from(Tag tag) {
        return new TagResponse(
                tag.getId(), tag.getName(), tag.getSlug(),
                tag.getColor(), tag.getUsageCount(), tag.getCreatedAt()
        );
    }
}