package com.poliwise.knowledge.client;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
    @SuppressWarnings("unchecked")
    public UUID resolveCategorySlug(String slug) {
        if (slug == null || slug.isBlank()) {
            return null;
        }
        try {
            List<Map<String, Object>> categories = metadataWebClient.get()
                    .uri("/api/v1/categories/active")
                    .retrieve()
                    .bodyToMono(List.class)
                    .timeout(TIMEOUT)
                    .block();

            if (categories == null) return null;

            return categories.stream()
                    .filter(cat -> slug.equalsIgnoreCase((String) cat.get("slug")))
                    .map(cat -> UUID.fromString((String) cat.get("id")))
                    .findFirst()
                    .orElse(null);
        } catch (Exception e) {
            log.warn("Failed to resolve category slug '{}': {}", slug, e.getMessage());
            return null;
        }
    }

    /**
     * Resolve tag names to UUIDs. Creates new tags in metadata-service if they don't exist.
     * GET /api/v1/tags is permitAll; POST /api/v1/tags requires auth (forwarded JWT).
     */
    @SuppressWarnings("unchecked")
    public List<UUID> resolveTagNames(List<String> tagNames) {
        if (tagNames == null || tagNames.isEmpty()) {
            return Collections.emptyList();
        }

        List<UUID> tagIds = new ArrayList<>();
        String authToken = getCurrentAuthToken();

        // Fetch all existing tags once (permitAll endpoint)
        List<Map<String, Object>> allTags;
        try {
            allTags = metadataWebClient.get()
                    .uri("/api/v1/tags")
                    .retrieve()
                    .bodyToMono(List.class)
                    .timeout(TIMEOUT)
                    .block();
        } catch (Exception e) {
            log.warn("Failed to fetch existing tags: {}", e.getMessage());
            allTags = Collections.emptyList();
        }

        Map<String, UUID> existingTagMap = new HashMap<>();
        if (allTags != null) {
            for (Map<String, Object> tag : allTags) {
                String name = (String) tag.get("name");
                String id = (String) tag.get("id");
                if (name != null && id != null) {
                    existingTagMap.put(name.toLowerCase(), UUID.fromString(id));
                }
            }
        }

        for (String tagName : tagNames) {
            if (tagName == null || tagName.isBlank()) continue;

            UUID existingId = existingTagMap.get(tagName.trim().toLowerCase());
            if (existingId != null) {
                tagIds.add(existingId);
            } else {
                // Create new tag (requires auth)
                UUID newId = createTag(tagName.trim(), authToken);
                if (newId != null) {
                    tagIds.add(newId);
                }
            }
        }

        return tagIds;
    }

    /**
     * Create a new tag in metadata-service (POST /api/v1/tags — requires ADMIN/MANAGER).
     */
    @SuppressWarnings("unchecked")
    private UUID createTag(String name, String authToken) {
        try {
            WebClient.RequestBodySpec req = metadataWebClient.post()
                    .uri("/api/v1/tags");

            if (authToken != null) {
                req = (WebClient.RequestBodySpec) req.header("Authorization", authToken);
            }

            Map<String, Object> response = req
                    .bodyValue(Map.of("name", name))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .timeout(TIMEOUT)
                    .block();

            if (response != null && response.get("id") != null) {
                UUID tagId = UUID.fromString((String) response.get("id"));
                log.info("Created new tag in metadata-service: name='{}', id={}", name, tagId);
                return tagId;
            }
        } catch (Exception e) {
            log.warn("Failed to create tag '{}': {} — it may already exist", name, e.getMessage());
        }
        return null;
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
            body.put("accessLevel", "PUBLIC");
            body.put("documentType", isPolicy != null && isPolicy ? "POLICY" : "GENERAL");
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
}
