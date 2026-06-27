package com.poliwise.feedback.dto.request;

import com.poliwise.feedback.enums.ViolationAction;
import jakarta.validation.constraints.NotNull;

public record ReviewViolationRequest(
        @NotNull ViolationAction action
) {}
