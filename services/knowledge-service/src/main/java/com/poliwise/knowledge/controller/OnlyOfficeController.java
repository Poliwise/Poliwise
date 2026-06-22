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

    // ===== 2d. Trigger save via OnlyOffice Command Service =====
    // Frontend "Lưu phiên bản mới" button calls this endpoint.
    // Backend sends a forcesave command to OnlyOffice DS Command Service,
    // which triggers a status=6 callback with the saved file URL.
    @PostMapping("/{documentId}/trigger-save")
    @PreAuthorize("hasAnyRole('USER', 'MANAGER', 'ADMIN')")
    public ResponseEntity<Map<String, Object>> triggerSave(
            @PathVariable UUID documentId,
            HttpServletRequest httpRequest) {
        UUID userId = getCurrentUserId(httpRequest);
        var result = onlyOfficeService.triggerForceSave(documentId, userId);

        if (result.hasConflict()) {
            return ResponseEntity.status(409).body(Map.of(
                    "accepted", false,
                    "hasConflict", true,
                    "message", result.message(),
                    "lockedVersion", result.lockedVersion(),
                    "currentVersion", result.currentVersion()
            ));
        }

        return ResponseEntity.ok(Map.of(
                "accepted", result.accepted(),
                "hasConflict", false,
                "message", result.message(),
                "lockedVersion", result.lockedVersion(),
                "currentVersion", result.currentVersion()
        ));
    }

    // ===== 2e. Relock for conflict resolution (merge/re-edit) =====
    // Releases the current lock and acquires a new one against the latest version.
    // Used when user chooses "Edit/Merge" in conflict resolution.
    @PostMapping("/{documentId}/relock")
    @PreAuthorize("hasAnyRole('USER', 'MANAGER', 'ADMIN')")
    public ResponseEntity<Map<String, Object>> relockForMerge(
            @PathVariable UUID documentId,
            HttpServletRequest httpRequest) {
        UUID userId = getCurrentUserId(httpRequest);
        String username = getCurrentUsername(httpRequest);
        var result = onlyOfficeService.relockForMerge(documentId, userId, username);
        return ResponseEntity.ok(result);
    }

    // ===== 3. Get editor configuration (for OnlyOffice iframe) =====
    @GetMapping("/{documentId}/editor-config")
    @PreAuthorize("hasAnyRole('USER', 'MANAGER', 'ADMIN')")
    public ResponseEntity<Map<String, Object>> getEditorConfig(
            @PathVariable UUID documentId,
            @RequestParam(value = "targetVersion", required = false) Integer targetVersion,
            HttpServletRequest httpRequest) {
        UUID userId = getCurrentUserId(httpRequest);
        String username = getCurrentUsername(httpRequest);
        Map<String, Object> config = onlyOfficeService.buildEditorConfigJson(documentId, userId, username, targetVersion);
        return ResponseEntity.ok(config);
    }

    // ===== 4. Process OnlyOffice save callback (JWT-authenticated by OnlyOfficeCallbackFilter) =====
    // OnlyOffice sends callbacks as JSON body (Content-Type: application/json):
    //   - status=1: editing in progress. Return {error:0,status:"editing"} to keep editor open.
    //   - status=2: user saved. OnlyOffice provides a "url" field pointing to the cached file
    //               on the DocumentServer. We download it from there and create a new version.
    //   - status=6: forcesave triggered via Command Service. Same as status=2.
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

        log.trace("OnlyOffice callback: documentId={}, status={}, url={}", documentId, status, savedFileUrl);

        // status=1: user is still editing — just keep the editor open
        if (status == null || status == 1) {
            return ResponseEntity.ok(OnlyOfficeCallbackResponse.forEditing(documentId));
        }

        // status=2: document was saved — download the file from DocumentServer and create new version
        // status=6: forcesave triggered — only process if it's a manual save (userdata starts with "manual_save_")
        //           Auto-saves from the editor (forcesave:true config) are acknowledged without creating versions.
        if (status == 2 || status == 6) {
            // For status=6 (forcesave), check if this is a manual save, or if there is a conflict.
            // If it is an auto-save without conflict, we just acknowledge.
            // If there is a conflict, we MUST process it to save the conflict file.
            if (status == 6) {
                String userdata = callback.getUserdata();
                boolean isManualSave = userdata != null && userdata.startsWith("manual_save_");
                boolean hasConflict = onlyOfficeService.hasConflict(documentId);

                if (!isManualSave && !hasConflict) {
                    // Auto-save from editor without conflict — just acknowledge, don't create a version
                    log.trace("OnlyOffice auto-save callback (status=6, no manual_save userdata, no conflict) for documentId={}, acknowledging without version creation", documentId);
                    return ResponseEntity.ok(OnlyOfficeCallbackResponse.forEditing(documentId));
                }
            }

            if (savedFileUrl == null || savedFileUrl.isBlank()) {
                log.warn("OnlyOffice callback (status={}) with no url for documentId={}", status, documentId);
                return ResponseEntity.badRequest()
                        .body(OnlyOfficeCallbackResponse.error("No url provided for save", documentId));
            }
            try {
                OnlyOfficeCallbackPrincipal principal = new OnlyOfficeCallbackPrincipal(
                        status == 6 ? "forcesave" : "save", documentId, callback.getKey());
                OnlyOfficeCallbackResponse response = onlyOfficeService.handleSaveCallbackFromUrl(
                        documentId, principal, savedFileUrl);
                return ResponseEntity.ok(response);
            } catch (Exception ex) {
                log.error("Error processing save callback for documentId={}: {}", documentId, ex.getMessage(), ex);
                return ResponseEntity.status(500)
                        .body(OnlyOfficeCallbackResponse.error("Save failed: " + ex.getMessage(), documentId));
            }
        }

        // status=4: document closed with no changes
        if (status == 4) {
            log.trace("OnlyOffice callback (status=4): document closed without saving, documentId={}", documentId);
            return ResponseEntity.ok(OnlyOfficeCallbackResponse.forEditing(documentId));
        }

        // Unknown status
            log.trace("OnlyOffice callback: unknown status={} for documentId={}", status, documentId);
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

    // ===== 11b. Re-open editor for merge without re-acquiring lock =====
    // Used when user picks "Chỉnh sửa lại" in conflict resolver.
    // Frontend already has the file blob from the previous editor session.
    // We serve editor config that points to the specific locked version (blob URL provided by frontend),
    // and return the latest version number so the frontend can show a preview panel.
    @PostMapping("/{documentId}/re-edit")
    @PreAuthorize("hasAnyRole('USER', 'MANAGER', 'ADMIN')")
    public ResponseEntity<Map<String, Object>> reOpenForMerge(
            @PathVariable UUID documentId,
            @RequestParam("lockToken") String lockToken,
            @RequestParam("targetVersion") Integer targetVersion,
            HttpServletRequest httpRequest) {
        UUID userId = getCurrentUserId(httpRequest);
        String username = getCurrentUsername(httpRequest);
        Map<String, Object> result = onlyOfficeService.buildReEditConfig(
                documentId, userId, username, lockToken, targetVersion);
        return ResponseEntity.ok(result);
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
