package com.poliwise.auth.dto.auth;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.poliwise.auth.enums.AccountStatus;
import com.poliwise.auth.enums.UserRole;
import java.util.UUID;

public record AuthUserView(
        @JsonProperty("userId") UUID id,
        String username,
        String email,
        UserRole role,
        AccountStatus status,
        @JsonProperty("mustChangePassword") Boolean mustChangePassword) {
}
