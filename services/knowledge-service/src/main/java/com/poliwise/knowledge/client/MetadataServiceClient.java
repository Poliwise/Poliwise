package com.poliwise.knowledge.client;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.*;

/**
 * Synchronous REST client for communicating with metadata-service.
 * Used during Phase 1 confirm flow to:
 *   1. Resolve category_slug → category_id (UUID)
 *   2. Resolve tag names → tag_ids (find-or-create)
 *   3. Create document_metadata record
 *
 * Forwards the current user's JWT token for authenticated endpoints.
 */
@Component
public class MetadataServiceClient {

    private static final Logger log = LoggerFactory.getLogger(MetadataServiceClient.class);
    private static final Duration TIMEOUT = Duration.ofSeconds(5);

    private final WebClient metadataWebClient;

    public MetadataServiceClient(WebClient metadataWebClient) {
        this.metadataWebClient = metadataWebClient;
    }

    /**
     * Extract the Authorization header from the current HTTP request context.
     * This allows service-to-service calls to forward the user's JWT.
     */
    private String getCurrentAuthToken() {
        try {
            ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                String auth = attrs.getRequest().getHeader("Authorization");
                if (auth != null && auth.startsWith("Bearer ")) {
                    return auth;
                }
            }
        } catch (Exception e) {
            log.debug("Could not extract Authorization header: {}", e.getMessage());
        }
        return null;
    }

    /**
     * Resolve a category slug to its UUID via GET /api/v1/categories/active.
     * This endpoint is permitAll in metadata-service — no auth needed.
     */
    public UUID resolveCategorySlug(String slug) {
        if (slug == null || slug.isBlank()) {
            return null;
        }
        try {
            List<com.poliwise.knowledge.dto.CategoryResponse> categories = metadataWebClient.get()
                    .uri("/api/v1/categories/active")
                    .retrieve()
                    .bodyToFlux(com.poliwise.knowledge.dto.CategoryResponse.class)
                    .collectList()
                    .timeout(TIMEOUT)
                    .block();

            if (categories == null) return null;

            return categories.stream()
                    .filter(cat -> slug.equalsIgnoreCase(cat.slug()))
                    .map(com.poliwise.knowledge.dto.CategoryResponse::id)
                    .findFirst()
                    .orElse(null);
        } catch (Exception e) {
            log.warn("Failed to resolve category slug '{}': {}", slug, e.getMessage());
            return null;
        }
    }

    /**
     * Resolve tag names to UUIDs. Uses bulk resolution API in metadata-service.
     * Creates new tags in metadata-service if they don't exist.
     * POST /api/v1/tags/resolve requires auth (forwarded JWT).
     */
    public List<UUID> resolveTagNames(List<String> tagNames) {
        if (tagNames == null || tagNames.isEmpty()) {
            return Collections.emptyList();
        }

        String authToken = getCurrentAuthToken();

        try {
            WebClient.RequestBodySpec requestSpec = metadataWebClient.post()
                    .uri("/api/v1/tags/resolve");

            if (authToken != null) {
                requestSpec = (WebClient.RequestBodySpec) requestSpec.header("Authorization", authToken);
            }

            com.poliwise.knowledge.dto.ResolveTagsResponse response = requestSpec
                    .bodyValue(Map.of("tagNames", tagNames))
                    .retrieve()
                    .bodyToMono(com.poliwise.knowledge.dto.ResolveTagsResponse.class)
                    .timeout(TIMEOUT)
                    .block();

            if (response != null && response.tagIds() != null) {
                log.info("Resolved {} tags (including potential auto-creation)", response.tagIds().size());
                return response.tagIds();
            }
        } catch (Exception e) {
            log.warn("Failed to resolve tags in bulk: {}", e.getMessage());
        }

        return Collections.emptyList();
    }

    /**
     * Create a document metadata record in metadata-service
     * (POST /api/v1/metadata — requires ADMIN).
     */
    @SuppressWarnings("unchecked")
    public void createDocumentMetadata(UUID documentId, String title, String description,
                                       UUID categoryId, List<UUID> tagIds, Boolean isPolicy) {
        String authToken = getCurrentAuthToken();

        try {
            Map<String, Object> body = new HashMap<>();
            body.put("documentId", documentId.toString());
            body.put("title", title);
            body.put("description", description);
            body.put("categoryId", categoryId != null ? categoryId.toString() : null);
            body.put("accessLevel", "RESTRICTED");
            body.put("documentType", isPolicy != null && isPolicy ? "POLICY" : "GENERAL");
            if (authToken != null) {
                UUID currentUserId = currentUserIdFromRequest();
                if (currentUserId != null) {
                    body.put("accessRules", List.of(Map.of(
                            "targetType", "USER",
                            "targetUserId", currentUserId.toString(),
                            "permission", "VIEW"
                    )));
                }
            }
            if (tagIds != null && !tagIds.isEmpty()) {
                body.put("tagIds", tagIds.stream().map(UUID::toString).toList());
            }

            WebClient.RequestBodySpec req = metadataWebClient.post()
                    .uri("/api/v1/metadata");

            if (authToken != null) {
                req = (WebClient.RequestBodySpec) req.header("Authorization", authToken);
            }

            Map<String, Object> response = req
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .timeout(TIMEOUT)
                    .block();

            log.info("Created document metadata in metadata-service: documentId={}, metadataId={}",
                    documentId, response != null ? response.get("id") : "unknown");
        } catch (Exception e) {
            log.error("Failed to create document metadata for documentId={}: {}",
                    documentId, e.getMessage(), e);
            throw new RuntimeException("Failed to save metadata: " + e.getMessage(), e);
        }
    }

    public void assertCanReadDocument(UUID documentId) {
        String authToken = getCurrentAuthToken();
        try {
            WebClient.RequestHeadersSpec<?> req = metadataWebClient.get()
                    .uri("/api/v1/metadata/document/{documentId}/access-check", documentId);

            if (authToken != null) {
                req = req.header("Authorization", authToken);
            }

            Map<String, Object> response = req
                    .retrieve()
                    .bodyToMono(Map.class)
                    .timeout(TIMEOUT)
                    .block();

            Object allowed = response != null ? response.get("allowed") : null;
            if (Boolean.TRUE.equals(allowed)) {
                return;
            }
            throw new AccessDeniedException("Document access denied");
        } catch (AccessDeniedException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Document access check failed closed for documentId={}: {}", documentId, e.getMessage());
            throw new AccessDeniedException("Document access denied");
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getIngestionAccessMetadata(UUID documentId, UUID fallbackUserId) {
        String authToken = getCurrentAuthToken();
        try {
            WebClient.RequestHeadersSpec<?> req = metadataWebClient.get()
                    .uri("/api/v1/metadata/document/{documentId}", documentId);
            if (authToken != null) {
                req = req.header("Authorization", authToken);
            }

            Map<String, Object> metadata = req
                    .retrieve()
                    .bodyToMono(Map.class)
                    .timeout(TIMEOUT)
                    .block();

            if (metadata == null) {
                return restrictedFallback(fallbackUserId);
            }

            Map<String, Object> payload = new HashMap<>();
            payload.put("access_level", metadata.getOrDefault("accessLevel", "RESTRICTED"));
            payload.put("department_id", metadata.get("departmentId"));
            payload.put("document_type", metadata.get("documentType"));
            payload.put("effective_date", metadata.get("effectiveDate"));
            payload.put("expiry_date", metadata.get("expiryDate"));

            List<Map<String, Object>> rules = metadata.get("accessRules") instanceof List<?>
                    ? (List<Map<String, Object>>) metadata.get("accessRules")
                    : List.of();
            payload.put("allowed_roles", rules.stream()
                    .filter(rule -> "VIEW".equals(rule.get("permission")))
                    .filter(rule -> "ROLE".equals(rule.get("targetType")))
                    .map(rule -> rule.get("targetRole"))
                    .filter(Objects::nonNull)
                    .toList());
            payload.put("allowed_departments", rules.stream()
                    .filter(rule -> "VIEW".equals(rule.get("permission")))
                    .filter(rule -> "DEPARTMENT".equals(rule.get("targetType")))
                    .map(rule -> rule.get("targetDepartmentId"))
                    .filter(Objects::nonNull)
                    .toList());
            payload.put("allowed_users", rules.stream()
                    .filter(rule -> "VIEW".equals(rule.get("permission")))
                    .filter(rule -> "USER".equals(rule.get("targetType")))
                    .map(rule -> rule.get("targetUserId"))
                    .filter(Objects::nonNull)
                    .toList());
            return payload;
        } catch (Exception e) {
            log.warn("Falling back to restricted ingestion ACL for documentId={}: {}", documentId, e.getMessage());
            return restrictedFallback(fallbackUserId);
        }
    }

    private Map<String, Object> restrictedFallback(UUID fallbackUserId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("access_level", "RESTRICTED");
        payload.put("allowed_roles", List.of());
        payload.put("allowed_departments", List.of());
        payload.put("allowed_users", fallbackUserId != null ? List.of(fallbackUserId.toString()) : List.of());
        return payload;
    }

    private UUID currentUserIdFromRequest() {
        try {
            ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                String userId = attrs.getRequest().getHeader("X-User-Id");
                if (userId != null && !userId.isBlank()) {
                    return UUID.fromString(userId);
                }
            }
        } catch (Exception e) {
            log.debug("Could not extract current user id: {}", e.getMessage());
        }
        return null;
    }
}
