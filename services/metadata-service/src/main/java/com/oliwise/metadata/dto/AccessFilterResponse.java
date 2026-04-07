package com.poliwise.metadata.dto;

import java.util.List;
import java.util.UUID;

public record AccessFilterResponse(
        List<UUID> allowedDocumentIds,
        int totalRequested,
        int totalAllowed
) {}