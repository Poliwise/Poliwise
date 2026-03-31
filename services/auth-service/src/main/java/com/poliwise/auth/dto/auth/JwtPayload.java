package com.poliwise.auth.dto.auth;

import java.time.Instant;
import java.util.UUID;

public record JwtPayload(UUID sub, String email, String role, Instant issuedAt, Instant expiresAt) {
}
