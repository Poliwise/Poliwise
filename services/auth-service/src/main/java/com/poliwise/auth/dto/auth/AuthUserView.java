package com.poliwise.auth.dto.auth;

import com.poliwise.auth.enums.AccountStatus;
import com.poliwise.auth.enums.UserRole;
import java.util.UUID;

public record AuthUserView(UUID id, String username, String email, UserRole role,
        AccountStatus status, Boolean mustChangePassword) {
}
