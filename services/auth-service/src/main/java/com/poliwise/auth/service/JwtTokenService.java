package com.poliwise.auth.service;

import com.poliwise.auth.config.AuthProperties;
import com.poliwise.auth.dto.auth.JwtPayload;
import com.poliwise.auth.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Component;

@Component
public class JwtTokenService {

    private final AuthProperties authProperties;
    private final SecretKey signingKey;

    public JwtTokenService(AuthProperties authProperties) {
        this.authProperties = authProperties;
        this.signingKey = Keys.hmacShaKeyFor(resolveSecretBytes(authProperties.jwt().secret()));
    }

    public String createAccessToken(User user) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(authProperties.jwt().accessTokenTtl());

        return Jwts.builder().subject(user.getId().toString()).issuer(authProperties.jwt().issuer())
                .issuedAt(Date.from(now)).expiration(Date.from(expiresAt))
                .claim("email", user.getEmail()).claim("role", user.getRole().name()).compact();
    }

    public JwtPayload verifyAccessToken(String token) {
        Claims claims =
                Jwts.parser().verifyWith(signingKey).build().parseSignedClaims(token).getPayload();

        Instant issuedAt = claims.getIssuedAt() == null ? null : claims.getIssuedAt().toInstant();
        Instant expiresAt =
                claims.getExpiration() == null ? null : claims.getExpiration().toInstant();

        return new JwtPayload(UUID.fromString(claims.getSubject()),
                claims.get("email", String.class), claims.get("role", String.class), issuedAt,
                expiresAt);
    }

    public long getAccessTokenExpiresInSeconds() {
        return authProperties.jwt().accessTokenTtl().toSeconds();
    }

    private static byte[] resolveSecretBytes(String secret) {
        try {
            byte[] decoded = Decoders.BASE64.decode(secret);
            if (decoded.length >= 32) {
                return decoded;
            }
        } catch (Exception ignored) {
            // Fallback to plain-text secret bytes below.
        }

        byte[] plain = secret.getBytes(StandardCharsets.UTF_8);
        if (plain.length < 32) {
            throw new IllegalArgumentException(
                    "auth.jwt.secret must be at least 32 bytes (or a base64 string decoding to >= 32 bytes)");
        }
        return plain;
    }

    public Key getSigningKey() {
        return signingKey;
    }
}
