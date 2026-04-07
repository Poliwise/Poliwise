package com.poliwise.metadata.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateTagRequest(
        @NotBlank(message = "name is required") @Size(max = 100, message = "name must be at most 100 characters") String name,
        @Size(max = 7, message = "color must be at most 7 characters (hex)") String color
) {}