package com.poliwise.knowledge.controller;

import com.poliwise.knowledge.dto.*;
import com.poliwise.knowledge.security.OnlyOfficeCallbackPrincipal;
import com.poliwise.knowledge.security.OnlyOfficeCallbackToken;
import com.poliwise.knowledge.service.OnlyOfficeService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.UUID;

/**
 * REST controller for OnlyOffice Document Server integration.
 * Handles:
 * - Acquiring/releasing edit locks
 * - Generating editor configuration for the frontend
 * - Processing OnlyOffice save callbacks
 * - Conflict detection and resolution
 * - Version diff computation
 * - Version deletion
 */
@RestController
@RequestMapping("/api/v1/documents")
@RequiredArgsConstructor
public class OnlyOfficeController {

    private static final Logger log = LoggerFactory.getLogger(OnlyOfficeController.class);

    private final OnlyOfficeService onlyOfficeService;

    // ===== 1. Acquire edit lock =====
    @PostMapping("/{documentId}/lock")
    @PreAuthorize("hasAnyRole('USER', 'MANAGER', 'ADMIN')")
    public ResponseEntity<LockResponse> acquireLock(
            @PathVariable UUID documentId,
            @RequestParam(required = false) Integer targetVersion,
            HttpServletRequest httpRequest) {
        UUID userId = getCurrentUserId(httpRequest);
        String username = getCurrentUsername(httpRequest);
        LockResponse lock = onlyOfficeService.acquireLock(documentId, userId, username, targetVersion);
        return ResponseEntity.ok(lock);
    }

    // ===== 2. Release edit lock =====
    @DeleteMapping("/{documentId}/lock")
    @PreAuthorize("hasAnyRole('USER', 'MANAGER', 'ADMIN')")
    public ResponseEntity<Void> releaseLock(
            @PathVariable UUID documentId,
            @RequestParam UUID lockToken,
            HttpServletRequest httpRequest) {
        UUID userId = getCurrentUserId(httpRequest);
        String role = getCurrentRole(httpRequest);
        boolean isAdmin = "ADMIN".equals(role);
        onlyOfficeService.releaseLock(documentId, lockToken, userId, isAdmin);
        return ResponseEntity.noContent().build();
    }

    // ===== 2b. Get lock status =====
    @GetMapping("/{documentId}/lock")
    @PreAuthorize("hasAnyRole('USER', 'MANAGER', 'ADMIN')")
    public ResponseEntity<Map<String, Object>> getLockStatus(@PathVariable UUID documentId) {
        var lock = onlyOfficeService.getLockStatus(documentId);
        if (lock.isPresent()) {
            var l = lock.get();
            return ResponseEntity.ok(Map.of(
                    "locked", true,
                    "versionAtLock", l.versionAtLock(),
                    "expiresAt", l.expiresAt().toString(),
                    "lockedBy", l.lockedBy().toString(),
                    "lockedByUsername", l.lockedByUsername() != null ? l.lockedByUsername() : ""
            ));
        }
        return ResponseEntity.ok(Map.of("locked", false));
    }

    // ===== 2c. Manual save (user clicks "Lưu phiên bản mới") =====
    // Frontend calls downloadAs() from OnlyOffice SDK to get the edited file blob,
    // then uploads it here. Backend detects conflicts and creates a new version.
    @PostMapping(value = "/{documentId}/save", consumes = "multipart/form-data")
    @PreAuthorize("hasAnyRole('USER', 'MANAGER', 'ADMIN')")
    public ResponseEntity<?> saveDocument(
            @PathVariable UUID documentId,
            @RequestParam("file") MultipartFile file,
            HttpServletRequest httpRequest) {
        UUID userId = getCurrentUserId(httpRequest);
        try {
            var result = onlyOfficeService.saveDocument(documentId, userId, file);
            return ResponseEntity.ok(Map.of("newVersion", result.newVersion()));
        } catch (OnlyOfficeService.ConflictException ex) {
            return ResponseEntity.status(409).body(Map.of(
                    "error", "conflict",
                    "message", ex.getMessage(),
                    "lockedVersion", ex.getLockedVersion(),
                    "currentVersion", ex.getCurrentVersion()
            ));
        }
    }

    // ===== 3. Get editor configuration (for OnlyOffice iframe) =====
    @GetMapping("/{documentId}/editor-config")
    @PreAuthorize("hasAnyRole('USER', 'MANAGER', 'ADMIN')")
    public ResponseEntity<Map<String, Object>> getEditorConfig(
            @PathVariable UUID documentId,
            HttpServletRequest httpRequest) {
        UUID userId = getCurrentUserId(httpRequest);
        String username = getCurrentUsername(httpRequest);
        Map<String, Object> config = onlyOfficeService.buildEditorConfigJson(documentId, userId, username);
        return ResponseEntity.ok(config);
    }

    // ===== 4. Process OnlyOffice save callback (JWT-authenticated by OnlyOfficeCallbackFilter) =====
    // OnlyOffice sends callbacks as JSON body (Content-Type: application/json):
    //   - status=1: editing in progress. Return {error:0,status:"editing"} to keep editor open.
    //   - status=2: user saved. OnlyOffice provides a "url" field pointing to the cached file
    //               on the DocumentServer. We download it from there and create a new version.
    @PostMapping(value = "/{documentId}/save-callback", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<OnlyOfficeCallbackResponse> handleSaveCallback(
            @PathVariable UUID documentId,
            @RequestBody OnlyOfficeCallbackDto callback,
            HttpServletRequest httpRequest) {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (!(auth instanceof OnlyOfficeCallbackToken)) {
            return ResponseEntity.status(401)
                    .body(OnlyOfficeCallbackResponse.error("Unauthorized callback", documentId));
        }

        Integer status = callback.getStatus();
        String savedFileUrl = callback.getUrl();

        log.debug("OnlyOffice callback: documentId={}, status={}, url={}", documentId, status, savedFileUrl);

        // status=1: user is still editing — just keep the editor open
        if (status == null || status == 1) {
            return ResponseEntity.ok(OnlyOfficeCallbackResponse.forEditing(documentId));
        }

        // status=2: document was saved — download the file from DocumentServer and create new version
        if (status == 2) {
            if (savedFileUrl == null || savedFileUrl.isBlank()) {
                log.warn("OnlyOffice callback (status=2) with no url for documentId={}", documentId);
                return ResponseEntity.badRequest()
                        .body(OnlyOfficeCallbackResponse.error("No url provided for save", documentId));
            }
            try {
                OnlyOfficeCallbackPrincipal principal = new OnlyOfficeCallbackPrincipal(
                        "save", documentId, callback.getKey());
                OnlyOfficeCallbackResponse response = onlyOfficeService.handleSaveCallbackFromUrl(
                        documentId, principal, savedFileUrl);
                return ResponseEntity.ok(response);
            } catch (Exception ex) {
                log.error("Error processing save callback for documentId={}: {}", documentId, ex.getMessage(), ex);
                return ResponseEntity.status(500)
                        .body(OnlyOfficeCallbackResponse.error("Save failed: " + ex.getMessage(), documentId));
            }
        }

        // Unknown status
        return ResponseEntity.ok(OnlyOfficeCallbackResponse.forEditing(documentId));
    }

    // ===== 5. Check conflict status =====
    @GetMapping("/{documentId}/conflict-status")
    @PreAuthorize("hasAnyRole('USER', 'MANAGER', 'ADMIN')")
    public ResponseEntity<ConflictStatusResponse> getConflictStatus(
            @PathVariable UUID documentId,
            HttpServletRequest httpRequest) {
        UUID userId = getCurrentUserId(httpRequest);
        ConflictStatusResponse status = onlyOfficeService.getConflictStatus(documentId, userId);
        return ResponseEntity.ok(status);
    }

    // ===== 6. Get version diff between two versions =====
    @GetMapping("/{documentId}/versions/diff")
    @PreAuthorize("hasAnyRole('USER', 'MANAGER', 'ADMIN')")
    public ResponseEntity<VersionDiffResponse> getVersionDiff(
            @PathVariable UUID documentId,
            @RequestParam int baseVersion,
            @RequestParam int compareVersion) {
        VersionDiffResponse diff = onlyOfficeService.computeVersionDiff(documentId, baseVersion, compareVersion);
        return ResponseEntity.ok(diff);
    }

    // ===== 7. Resolve conflict (merge, discard, force-push) =====
    @PostMapping("/{documentId}/resolve-conflict")
    @PreAuthorize("hasAnyRole('USER', 'MANAGER', 'ADMIN')")
    public ResponseEntity<Map<String, Object>> resolveConflict(
            @PathVariable UUID documentId,
            @Valid @RequestParam("strategy") String strategy,
            @RequestParam("lockToken") UUID lockToken,
            @RequestParam(value = "mergedChangelog", required = false) String mergedChangelog,
            @RequestParam(value = "file", required = false) MultipartFile file,
            HttpServletRequest httpRequest) {

        UUID userId = getCurrentUserId(httpRequest);
        String role = getCurrentRole(httpRequest);
        boolean isAdmin = "ADMIN".equals(role);

        ConflictResolutionRequest request = new ConflictResolutionRequest(
                strategy, lockToken, mergedChangelog);

        var version = onlyOfficeService.resolveConflict(
                documentId, request, file, userId, isAdmin);

        if (version == null) {
            return ResponseEntity.ok(Map.of("message", "Changes discarded", "resolved", true));
        }

        return ResponseEntity.ok(Map.of(
                "message", "Conflict resolved successfully",
                "resolved", true,
                "newVersion", version.getVersionNumber(),
                "newVersionId", version.getId()
        ));
    }

    // ===== 8. Force-push a new version (ADMIN only, shortcut for resolve-conflict with strategy=force_push) =====
    @PostMapping("/{documentId}/force-push")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> forcePush(
            @PathVariable UUID documentId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "changelog", required = false, defaultValue = "Force-pushed version") String changelog,
            HttpServletRequest httpRequest) {

        UUID userId = getCurrentUserId(httpRequest);

        ConflictResolutionRequest request = new ConflictResolutionRequest(
                "force_push", null, changelog);

        var version = onlyOfficeService.resolveConflict(
                documentId, request, file, userId, true);

        return ResponseEntity.ok(Map.of(
                "message", "Force push successful",
                "newVersion", version.getVersionNumber(),
                "newVersionId", version.getId()
        ));
    }

    // ===== 9. Delete a specific version (ADMIN only, cannot delete latest or only version) =====
    @DeleteMapping("/{documentId}/versions/{versionNumber}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> deleteVersion(
            @PathVariable UUID documentId,
            @PathVariable int versionNumber,
            @RequestParam(value = "reason", required = false) String reason,
            HttpServletRequest httpRequest) {
        UUID deletedBy = getCurrentUserId(httpRequest);
        onlyOfficeService.deleteVersion(documentId, versionNumber, deletedBy, reason);
        return ResponseEntity.ok(Map.of(
                "message", "Version " + versionNumber + " deleted successfully",
                "documentId", documentId.toString(),
                "deletedVersion", versionNumber
        ));
    }

    // ===== 10. Fetch latest version metadata + presigned URL =====
    @GetMapping("/{documentId}/fetch-latest")
    @PreAuthorize("hasAnyRole('USER', 'MANAGER', 'ADMIN')")
    public ResponseEntity<FetchLatestVersionResponse> fetchLatestVersion(
            @PathVariable UUID documentId) {
        FetchLatestVersionResponse response = onlyOfficeService.fetchLatestVersion(documentId);
        return ResponseEntity.ok(response);
    }

    // ===== 11. Autocomplete callback placeholder (OnlyOffice SDK placeholder) =====
    @PostMapping("/{documentId}/save-callback/autocomplete")
    public ResponseEntity<Void> handleAutocomplete(@PathVariable UUID documentId) {
        return ResponseEntity.ok().build();
    }

    // ===== 12. Serve document file for OnlyOffice DS (no auth required) =====
    // OnlyOffice Document Server fetches the file directly via JWT token in Authorization header.
    // This proxy avoids the presigned URL Host-header mismatch that occurs when the presigned
    // URL is generated by MinIO with "minio:9000" as the signing host but OnlyOffice uses "localhost:8888".
    @GetMapping(value = "/{documentId}/file", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public void serveFileForOnlyOffice(
            @PathVariable UUID documentId,
            HttpServletRequest httpRequest,
            jakarta.servlet.http.HttpServletResponse response) throws Exception {
        onlyOfficeService.streamFileToResponse(documentId, response);
    }

    // ===== Helper Methods =====

    private UUID getCurrentUserId(HttpServletRequest request) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof com.poliwise.knowledge.security.JwtAuthenticationToken jwtToken) {
            return jwtToken.getUserId();
        }
        throw new org.springframework.security.access.AccessDeniedException("User not authenticated");
    }

    private String getCurrentUsername(HttpServletRequest request) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof com.poliwise.knowledge.security.JwtAuthenticationToken jwtToken) {
            return jwtToken.getUsername();
        }
        return null;
    }

    private String getCurrentRole(HttpServletRequest request) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof com.poliwise.knowledge.security.JwtAuthenticationToken jwtToken) {
            return jwtToken.getRole().name();
        }
        return null;
    }
}
