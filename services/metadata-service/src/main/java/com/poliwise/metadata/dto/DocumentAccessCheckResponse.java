package com.poliwise.metadata.dto;

import java.util.UUID;

public record DocumentAccessCheckResponse(
        UUID documentId,
        boolean allowed,
        String reason
) {}
