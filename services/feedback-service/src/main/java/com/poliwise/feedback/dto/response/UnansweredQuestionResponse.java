package com.poliwise.feedback.dto.response;

import java.time.Instant;
import java.util.UUID;

public record UnansweredQuestionResponse(
        UUID id,
        String question,
        UUID userId,
        UUID userDepartmentId,
        String category,
        String priority,
        Boolean resolved,
        Instant createdAt,
        Instant resolvedAt,
        String resolutionNotes
) {}
