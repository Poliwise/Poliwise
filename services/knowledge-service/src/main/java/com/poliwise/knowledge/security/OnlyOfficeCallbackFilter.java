package com.poliwise.knowledge.security;

import com.poliwise.knowledge.config.OnlyOfficeProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Optional;
import java.util.UUID;

/**
 * Validates OnlyOffice Document Server callback requests.
 * OnlyOffice sends a JWT token in the Authorization header when calling save callbacks.
 * This filter verifies that token using the shared OnlyOffice JWT secret (separate from
 * the Poliwise user JWT secret) and sets up a minimal security context.
 *
 * OnlyOffice callback paths:
 *   POST /api/v1/documents/{id}/save-callback
 */
@Component
public class OnlyOfficeCallbackFilter extends OncePerRequestFilter {

    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    private final SecretKey signingKey;

    public OnlyOfficeCallbackFilter(OnlyOfficeProperties properties) {
        this.signingKey = Keys.hmacShaKeyFor(
                properties.getJwtSecret().getBytes(StandardCharsets.UTF_8));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        Optional<String> rawToken = extractBearerToken(request);
        if (rawToken.isEmpty()) {
            sendError(response, HttpServletResponse.SC_UNAUTHORIZED, "Missing OnlyOffice callback token");
            return;
        }

        try {
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(rawToken.get())
                    .getPayload();

            String action = claims.get("action", String.class);
            String documentId = claims.get("documentId", String.class);
            String key = claims.get("key", String.class);

            if (!StringUtils.hasText(action) || !StringUtils.hasText(documentId) || !StringUtils.hasText(key)) {
                sendError(response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid OnlyOffice callback token claims");
                return;
            }

            if (!isAllowedAction(action, request.getServletPath())) {
                sendError(response, HttpServletResponse.SC_UNAUTHORIZED, "OnlyOffice callback action does not match the request");
                return;
            }

            if (request.getServletPath().endsWith("/file")) {
                UUID requestedDocumentId = extractDocumentId(request.getServletPath());
                if (!"download".equals(action)
                        || !requestedDocumentId.equals(UUID.fromString(documentId))) {
                    sendError(response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid document download token");
                    return;
                }
            }

            // OnlyOffice callback context — a lightweight auth principal for the callback endpoint
            OnlyOfficeCallbackPrincipal principal = new OnlyOfficeCallbackPrincipal(
                    action != null ? action : "unknown",
                    documentId != null ? UUID.fromString(documentId) : null,
                    key
            );

            OnlyOfficeCallbackToken callbackToken = new OnlyOfficeCallbackToken(principal);

            SecurityContextHolder.getContext().setAuthentication(callbackToken);

            request.setAttribute("onlyoffice.action", action);
            request.setAttribute("onlyoffice.documentId", documentId);
            request.setAttribute("onlyoffice.key", key);

            } catch (JwtException | IllegalArgumentException ex) {
            sendError(response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid OnlyOffice callback token: " + ex.getMessage());
            return;
        }

        filterChain.doFilter(request, response);
    }

    private Optional<String> extractBearerToken(HttpServletRequest request) {
        String header = request.getHeader(AUTHORIZATION_HEADER);
        if (StringUtils.hasText(header) && header.startsWith(BEARER_PREFIX)) {
            String token = header.substring(BEARER_PREFIX.length()).trim();
            if (!token.isEmpty()) {
                return Optional.of(token);
            }
        }
        String queryToken = request.getParameter("token");
        if (StringUtils.hasText(queryToken)) {
            return Optional.of(queryToken.trim());
        }
        return Optional.empty();
    }

    private UUID extractDocumentId(String path) {
        String marker = "/api/v1/documents/";
        int start = path.indexOf(marker);
        if (start < 0) {
            throw new IllegalArgumentException("Invalid document path");
        }
        String remainder = path.substring(start + marker.length());
        int slash = remainder.indexOf('/');
        return UUID.fromString(slash >= 0 ? remainder.substring(0, slash) : remainder);
    }

    private void sendError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\": \"" + message + "\"}");
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        return !path.contains("/save-callback") && !path.endsWith("/file");
    }

    private boolean isAllowedAction(String action, String path) {
        if (path.endsWith("/file")) {
            return "download".equals(action);
        }
        return "save".equals(action) || "forcesave".equals(action);
    }
}
