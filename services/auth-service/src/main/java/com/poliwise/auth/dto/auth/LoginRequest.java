package com.poliwise.auth.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(@NotBlank @Size(max = 255) String identifier,
        @NotBlank @Size(min = 8, max = 128) String password) {
}
