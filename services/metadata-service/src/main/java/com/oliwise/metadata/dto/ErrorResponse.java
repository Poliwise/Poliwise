package com.poliwise.metadata.dto;

import java.time.OffsetDateTime;
import java.util.Map;

public record ErrorResponse(
        int status,
        String code,
        String message,
        OffsetDateTime timestamp,
        String path,
        Map<String, String> validationErrors
) {
    public static ErrorResponse of(int status, String code, String message, String path) {
        return new ErrorResponse(status, code, message, OffsetDateTime.now(), path, null);
    }

    public static ErrorResponse validation(int status, String code, String message,
                                           String path, Map<String, String> errors) {
        return new ErrorResponse(status, code, message, OffsetDateTime.now(), path, errors);
    }
}