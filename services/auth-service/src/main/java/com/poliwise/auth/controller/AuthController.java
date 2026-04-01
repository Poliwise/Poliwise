package com.poliwise.auth.controller;

import com.poliwise.auth.dto.auth.ClientMetadata;
import com.poliwise.auth.dto.auth.LoginRequest;
import com.poliwise.auth.dto.auth.LogoutRequest;
import com.poliwise.auth.dto.auth.RefreshTokenRequest;
import com.poliwise.auth.dto.auth.RegisterRequest;
import com.poliwise.auth.dto.auth.TokenResponse;
import com.poliwise.auth.security.JwtAuthenticationToken;
import com.poliwise.auth.service.AuthService;
import com.poliwise.auth.service.RefreshTokenService;
import com.poliwise.auth.service.RefreshTokenService.RefreshTokenInfo;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final RefreshTokenService refreshTokenService;

    public AuthController(AuthService authService, RefreshTokenService refreshTokenService) {
        this.authService = authService;
        this.refreshTokenService = refreshTokenService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request, HttpServletRequest httpRequest) {
        ClientMetadata metadata = extractMetadata(httpRequest);
        var user = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(user);
    }

    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        ClientMetadata metadata = extractMetadata(httpRequest);
        TokenResponse response = authService.login(request, metadata);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/refresh")
    public ResponseEntity<TokenResponse> refresh(
            @Valid @RequestBody RefreshTokenRequest request,
            @RequestHeader("X-User-Id") UUID userId,
            HttpServletRequest httpRequest) {
        ClientMetadata metadata = extractMetadata(httpRequest);
        TokenResponse response = authService.refresh(request.refreshToken(), userId, metadata);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(
            @Valid @RequestBody LogoutRequest request,
            @AuthenticationPrincipal JwtAuthenticationToken authToken,
            HttpServletRequest httpRequest) {

        if (authToken == null || authToken.getPayload() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Authentication required"));
        }

        String rawAccessToken = extractRawAccessToken(httpRequest);
        authService.logout(request.refreshToken(), authToken.getPayload().sub(), rawAccessToken);

        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    @PostMapping("/logout-all")
    public ResponseEntity<?> logoutAll(
            @AuthenticationPrincipal JwtAuthenticationToken authToken,
            HttpServletRequest httpRequest) {

        if (authToken == null || authToken.getPayload() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Authentication required"));
        }

        String rawAccessToken = extractRawAccessToken(httpRequest);
        int count = authService.logoutAllDevices(authToken.getPayload().sub(), rawAccessToken);

        return ResponseEntity.ok(Map.of(
                "message", "All sessions revoked",
                "sessionsRevoked", count
        ));
    }

    @GetMapping("/sessions")
    public ResponseEntity<?> getActiveSessions(@AuthenticationPrincipal JwtAuthenticationToken authToken) {
        if (authToken == null || authToken.getPayload() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Authentication required"));
        }

        List<RefreshTokenInfo> sessions = refreshTokenService.getActiveSessions(authToken.getPayload().sub());
        return ResponseEntity.ok(Map.of("sessions", sessions));
    }

    private ClientMetadata extractMetadata(HttpServletRequest request) {
        String ipAddress = resolveIpAddress(request);
        String userAgent = request.getHeader("User-Agent");
        String deviceInfo = parseDeviceType(userAgent);
        return new ClientMetadata(ipAddress, userAgent, deviceInfo);
    }

    private String resolveIpAddress(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp.trim();
        }
        return request.getRemoteAddr();
    }

    private String parseDeviceType(String userAgent) {
        if (userAgent == null) return "Unknown";
        String ua = userAgent.toLowerCase();
        if (ua.contains("mobile") || ua.contains("android") || ua.contains("iphone")) {
            return "Mobile";
        }
        if (ua.contains("tablet") || ua.contains("ipad")) {
            return "Tablet";
        }
        return "Desktop";
    }

    private String extractRawAccessToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7).trim();
        }
        return null;
    }
}
