package com.poliwise.feedback.dto.response;

import java.time.Instant;
import java.util.UUID;

public record UnansweredQuestionResponse(
        UUID id,
        String question,
        Integer askCount,
        String departmentName,
        String userName,
        Instant firstAskedAt,
        Instant lastAskedAt,
        String status,
        String suggestedAnswer
) {}
