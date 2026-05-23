package com.poliwise.knowledge.service;

import com.github.difflib.DiffUtils;
import com.github.difflib.patch.AbstractDelta;
import com.github.difflib.patch.DeltaType;
import com.github.difflib.patch.Patch;
import com.github.difflib.patch.PatchFailedException;
import com.poliwise.knowledge.config.OnlyOfficeProperties;
import com.poliwise.knowledge.dto.*;
import com.poliwise.knowledge.entity.Document;
import com.poliwise.knowledge.entity.DocumentAuditLog;
import com.poliwise.knowledge.entity.DocumentLock;
import com.poliwise.knowledge.entity.DocumentVersion;
import com.poliwise.knowledge.entity.DocumentVersionDeletion;
import com.poliwise.knowledge.exception.ResourceNotFoundException;
import com.poliwise.knowledge.repository.DocumentAuditLogRepository;
import com.poliwise.knowledge.repository.DocumentLockRepository;
import com.poliwise.knowledge.repository.DocumentRepository;
import com.poliwise.knowledge.repository.DocumentVersionDeletionRepository;
import com.poliwise.knowledge.repository.DocumentVersionRepository;
import com.poliwise.knowledge.security.OnlyOfficeCallbackPrincipal;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.crypto.SecretKey;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.*;

/**
 * Core service for OnlyOffice Document Server integration.
 * Handles:
 * - Document edit locking (optimistic lock, 30-min expiry)
 * - Editor configuration generation (JWT-secured config for OnlyOffice iframe)
 * - Save callback processing (with version conflict detection)
 * - Version diff computation (java-diff-utils for TXT/MD)
 * - Conflict resolution (merge-as-new, discard-mine, force-push)
 * - Version deletion (soft-delete with archive)
 */
@Service
public class OnlyOfficeService {

    private static final Logger log = LoggerFactory.getLogger(OnlyOfficeService.class);

    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository versionRepository;
    private final DocumentLockRepository lockRepository;
    private final DocumentVersionDeletionRepository deletionRepository;
    private final DocumentAuditLogRepository auditLogRepository;
    private final StorageService storageService;
    private final OnlyOfficeProperties properties;
    private final SecretKey jwtSigningKey;

    public OnlyOfficeService(
            DocumentRepository documentRepository,
            DocumentVersionRepository versionRepository,
            DocumentLockRepository lockRepository,
            DocumentVersionDeletionRepository deletionRepository,
            DocumentAuditLogRepository auditLogRepository,
            StorageService storageService,
            OnlyOfficeProperties properties) {
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.lockRepository = lockRepository;
        this.deletionRepository = deletionRepository;
        this.auditLogRepository = auditLogRepository;
        this.storageService = storageService;
        this.properties = properties;
        this.jwtSigningKey = Keys.hmacShaKeyFor(
                properties.getJwtSecret().getBytes(StandardCharsets.UTF_8));
    }

    // ========== Locking ==========

    /**
     * Acquire an edit lock for a document.
     * Fails if the document is already locked by another user.
     * If the same user holds the lock, extends its expiry.
     * @param targetVersion if provided, locks against a specific version (for editing old versions).
     *                      Otherwise locks against the current (latest) version.
     */
    @Transactional
    public LockResponse acquireLock(UUID documentId, UUID userId, String username, Integer targetVersion) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        if (document.getDeletedAt() != null) {
            throw new IllegalStateException("Cannot lock a deleted document");
        }

        // Determine which version to lock against
        int versionToLock;
        if (targetVersion != null && targetVersion > 0) {
            // Validate the target version exists
            versionRepository.findByDocumentIdAndVersionNumber(documentId, targetVersion)
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Version " + targetVersion + " does not exist for this document"));
            versionToLock = targetVersion;
        } else {
            versionToLock = document.getCurrentVersion();
        }

        Optional<DocumentLock> existing = lockRepository.findByDocumentId(documentId);

        if (existing.isPresent()) {
            DocumentLock lock = existing.get();
            if (lock.isExpired()) {
                int expiredVersion = lock.getVersionAtLock();
                lockRepository.delete(lock);
                logAudit(documentId, "ONLYOFFICE_LOCK_EXPIRED",
                        Map.of("versionAtLock", expiredVersion), null, userId);
            } else if (!lock.isOwnedBy(userId)) {
                throw new IllegalStateException(
                        "Document is currently being edited by another user. Please try again later.");
            } else {
                // Same user — extend lock
                lock.setExpiresAt(OffsetDateTime.now().plusMinutes(properties.getLockDurationMinutes()));
                DocumentLock saved = lockRepository.save(lock);
                logAudit(documentId, "ONLYOFFICE_LOCK_EXTENDED",
                        Map.of("versionAtLock", saved.getVersionAtLock()),
                        Map.of("expiresAt", saved.getExpiresAt().toString()), userId);
                return toLockResponse(saved);
            }
        }

        // Create new lock
        DocumentLock newLock = DocumentLock.builder()
                .documentId(documentId)
                .lockedBy(userId)
                .lockedAt(OffsetDateTime.now())
                .expiresAt(OffsetDateTime.now().plusMinutes(properties.getLockDurationMinutes()))
                .lockToken(UUID.randomUUID())
                .versionAtLock(versionToLock)
                .lockedByUsername(username)
                .build();

        DocumentLock saved = lockRepository.save(newLock);
        log.info("Lock acquired: documentId={}, userId={}, version={}",
                documentId, userId, versionToLock);
        logAudit(documentId, "ONLYOFFICE_LOCK_ACQUIRED",
                targetVersion != null ? Map.of("targetVersion", targetVersion) : null,
                Map.of("versionAtLock", saved.getVersionAtLock(), "expiresAt", saved.getExpiresAt().toString()), userId);
        return toLockResponse(saved);
    }

    /**
     * Release an edit lock.
     * Only the lock owner or an admin can release it.
     */
    @Transactional
    public void releaseLock(UUID documentId, UUID lockToken, UUID userId, boolean isAdmin) {
        DocumentLock lock = lockRepository.findByDocumentId(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("No lock found for document: " + documentId));

        if (!lock.matchesToken(lockToken) && !isAdmin) {
            throw new SecurityException("Invalid lock token");
        }

        int releasedVersion = lock.getVersionAtLock();
        lockRepository.delete(lock);
        log.info("Lock released: documentId={}, userId={}", documentId, userId);
        logAudit(documentId, "ONLYOFFICE_LOCK_RELEASED",
                Map.of("versionAtLock", releasedVersion), null, userId);
    }

    /**
     * Check if a document has an active (non-expired) lock.
     */
    public boolean isLocked(UUID documentId) {
        return lockRepository.findByDocumentId(documentId)
                .map(lock -> !lock.isExpired())
                .orElse(false);
    }

    /**
     * Get current lock status for a document.
     */
    public Optional<LockResponse> getLockStatus(UUID documentId) {
        return lockRepository.findByDocumentId(documentId)
                .filter(lock -> !lock.isExpired())
                .map(this::toLockResponse);
    }

    // ========== Editor Config ==========

    /**
     * Generate OnlyOffice editor configuration (JSON) for the iframe.
     * This config is JWT-signed with the OnlyOffice shared secret so the
     * Document Server can verify the request authenticity.
     */
    public EditorConfigResponse generateEditorConfig(UUID documentId, UUID userId, String username) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        DocumentLock lock = lockRepository.findByDocumentId(documentId)
                .orElseThrow(() -> new IllegalStateException("No active lock found. Please acquire a lock first."));

        if (lock.isExpired()) {
            throw new IllegalStateException("Lock has expired. Please re-acquire the lock.");
        }

        String fileType = document.getFileType() != null
                ? document.getFileType().toString().toLowerCase() : "docx";
        String documentType = mapToOnlyOfficeDocumentType(fileType);

        // Build the editor config JSON (OnlyOffice expects this structure)
        Map<String, Object> tokenPayload = new LinkedHashMap<>();
        tokenPayload.put("documentId", documentId.toString());
        tokenPayload.put("userId", userId.toString());
        tokenPayload.put("lockToken", lock.getLockToken().toString());
        tokenPayload.put("version", document.getCurrentVersion());
        tokenPayload.put("exp", System.currentTimeMillis() / 1000 + 3600); // 1 hour expiry

        String editorToken = Jwts.builder()
                .claims(tokenPayload)
                .signWith(jwtSigningKey)
                .compact();

        // Get the file URL for OnlyOffice to fetch
        String fileKey = document.getFileKey();
        String fileUrl = storageService.getFileUrl(fileKey);

        DocumentServerConfig config = new DocumentServerConfig(
                new Lang("vi", true),
                new CallbackSettings(properties.getCallbackUrl() + "/" + documentId + "/save-callback"),
                new EditorConfig(
                        0, 0,
                        properties.getCallbackUrl() + "/" + documentId + "/autocomplete",
                        null, null,
                        new CallbackUser(userId.toString(), username != null ? username : "Anonymous")
                ),
                new EmbeddedConfig(null, null, null, null, "top")
        );

        return new EditorConfigResponse(
                documentType,
                document.getOriginalFilename(),
                fileUrl,
                fileType,
                config
        );
    }

    /**
     * Build the raw JSON config object for OnlyOffice SDK.
     * Returns a Map that will be serialized to JSON for the frontend.
     */
    public Map<String, Object> buildEditorConfigJson(UUID documentId, UUID userId, String username) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        DocumentLock lock = lockRepository.findByDocumentId(documentId)
                .orElseThrow(() -> new IllegalStateException("No active lock found for document: " + documentId));

        if (lock.isExpired()) {
            throw new IllegalStateException("Lock has expired. Please re-acquire the lock.");
        }

        String fileType = document.getFileType() != null
                ? document.getFileType().toString().toLowerCase() : "docx";
        String documentType = mapToOnlyOfficeDocumentType(fileType);

        String fileUrl = properties.getCallbackPublicUrl() + "/" + documentId + "/file";
        String documentKey = lock.getLockToken().toString();
        String callbackToken = buildCallbackToken(documentId, documentKey, fileUrl);
        String callbackUrl = properties.getCallbackPublicUrl() + "/" + documentId + "/save-callback";

        // Build document config
        java.util.Map<String, Object> docCfg = new java.util.LinkedHashMap<>();
        docCfg.put("title", document.getOriginalFilename() != null ? document.getOriginalFilename() : "document." + fileType);
        docCfg.put("fileType", fileType);
        docCfg.put("url", fileUrl);
        docCfg.put("key", documentKey);

        // Build user config
        java.util.Map<String, Object> userCfg = new java.util.LinkedHashMap<>();
        userCfg.put("id", userId.toString());
        userCfg.put("name", username != null ? username : "Anonymous");

        // Events: onDocumentReady fires when the editor iframe is fully loaded.
        // Frontend listens via window.message and attaches save handlers to the editor instance.
        java.util.Map<String, Object> events = new java.util.LinkedHashMap<>();
        events.put("onDocumentReady", "function() { window.parent.postMessage({type: 'onlyoffice_ready'}, '*'); }");
        events.put("onRequestSaveAs", "function(event) { window.parent.postMessage({type: 'onlyoffice_save_as', key: event.data.key, title: event.data.title, format: event.data.format}, '*'); }");
        events.put("onDocumentSave", "function(event) { window.parent.postMessage({type: 'onlyoffice_doc_save', saved: event.data.saved}, '*'); }");

        // Build editorConfig
        java.util.Map<String, Object> editorCfg = new java.util.LinkedHashMap<>();
        editorCfg.put("callbackUrl", callbackUrl);
        editorCfg.put("user", userCfg);
        editorCfg.put("lang", "vi");
        editorCfg.put("forcesave", true);
        editorCfg.put("events", events);

        // Build final config
        java.util.Map<String, Object> config = new java.util.LinkedHashMap<>();
        config.put("document", docCfg);
        config.put("documentType", documentType);
        config.put("editorConfig", editorCfg);
        config.put("token", callbackToken);
        config.put("type", "desktop");

        return config;
    }

    /**
     * Build a JWT token for OnlyOffice Document Server to verify callbacks.
     * The document.url inside the token uses the internal Docker URL (minio:9000)
     * so OnlyOffice DS can fetch the file from MinIO within the Docker network.
     */
    private String buildCallbackToken(UUID documentId, String documentKey, String fileUrlForToken) {
        Map<String, Object> callbackTokenPayload = new LinkedHashMap<>();
        Map<String, Object> tokenDocument = new LinkedHashMap<>();
        tokenDocument.put("key", documentKey);
        tokenDocument.put("url", fileUrlForToken);
        callbackTokenPayload.put("document", tokenDocument);

        Map<String, Object> tokenEditorConfig = new LinkedHashMap<>();
        tokenEditorConfig.put("callbackUrl", properties.getCallbackPublicUrl() + "/" + documentId + "/save-callback");
        tokenEditorConfig.put("mode", "edit");
        callbackTokenPayload.put("editorConfig", tokenEditorConfig);

        callbackTokenPayload.put("exp", System.currentTimeMillis() / 1000 + 86400);

        return Jwts.builder()
                .claims(callbackTokenPayload)
                .signWith(jwtSigningKey)
                .compact();
    }

    // ========== Save Callback ==========

    /**
     * Process OnlyOffice save callback.
     * OnlyOffice sends the new file binary when user saves.
     * Detects version conflicts (someone uploaded a newer version while we were editing).
     */
    @Transactional
    public OnlyOfficeCallbackResponse handleSaveCallback(
            UUID documentId,
            OnlyOfficeCallbackPrincipal principal,
            MultipartFile file) {

        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        Optional<DocumentLock> lockOpt = lockRepository.findByDocumentId(documentId);

        if (lockOpt.isEmpty()) {
            log.warn("Save callback with no lock: documentId={}", documentId);
            return OnlyOfficeCallbackResponse.error("No active lock found for this document", documentId);
        }

        DocumentLock lock = lockOpt.get();

        if (lock.isExpired()) {
            return OnlyOfficeCallbackResponse.error("Lock has expired", documentId);
        }

        // Conflict detection: if current version > version at lock, someone else uploaded a new version
        if (document.getCurrentVersion() > lock.getVersionAtLock()) {
            int lockedVersion = lock.getVersionAtLock();
            int currentVersion = document.getCurrentVersion();
            log.info("Version conflict detected: documentId={}, lockedVersion={}, currentVersion={}",
                    documentId, lockedVersion, currentVersion);
            logAudit(documentId, "ONLYOFFICE_CONFLICT_DETECTED",
                    Map.of("lockedVersion", lockedVersion),
                    Map.of("currentVersion", currentVersion), lock.getLockedBy());
            return OnlyOfficeCallbackResponse.conflict(
                    "A newer version has been uploaded. Please resolve the conflict before saving.",
                    documentId);
        }

        // Safe to save — upload new file and create new version
        int oldVersion = document.getCurrentVersion();
        String newFileKey = storageService.uploadFile(file, documentId);
        int newVersionNumber = document.getCurrentVersion() + 1;

        DocumentVersion version = DocumentVersion.builder()
                .id(UUID.randomUUID())
                .documentId(documentId)
                .versionNumber(newVersionNumber)
                .fileKey(newFileKey)
                .fileSizeBytes(file.getSize())
                .changelog("Edited via OnlyOffice")
                .createdBy(lock.getLockedBy())
                .createdAt(OffsetDateTime.now())
                .build();
        versionRepository.save(version);

        document.setCurrentVersion(newVersionNumber);
        document.setFileKey(newFileKey);
        document.setFileSizeBytes(file.getSize());
        document.setUpdatedAt(OffsetDateTime.now());
        documentRepository.save(document);

        // Release lock after successful save
        lockRepository.delete(lock);

        log.info("OnlyOffice save callback processed: documentId={}, newVersion={}",
                documentId, newVersionNumber);
        logAudit(documentId, "ONLYOFFICE_SAVE_SUCCESS",
                Map.of("oldVersion", oldVersion),
                Map.of("newVersion", newVersionNumber, "fileKey", newFileKey), lock.getLockedBy());
        return OnlyOfficeCallbackResponse.success(newVersionNumber, documentId);
    }

    /**
     * Process save callback when OnlyOffice provides a URL to the saved file.
     * Downloads the file from the DocumentServer URL and creates a new version.
     */
    @Transactional
    public OnlyOfficeCallbackResponse handleSaveCallbackFromUrl(
            UUID documentId,
            OnlyOfficeCallbackPrincipal principal,
            String savedFileUrl) {

        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        Optional<DocumentLock> lockOpt = lockRepository.findByDocumentId(documentId);
        if (lockOpt.isEmpty()) {
            log.warn("Save callback with no lock: documentId={}", documentId);
            return OnlyOfficeCallbackResponse.error("No active lock found for this document", documentId);
        }

        DocumentLock lock = lockOpt.get();
        if (lock.isExpired()) {
            return OnlyOfficeCallbackResponse.error("Lock has expired", documentId);
        }

        // Conflict detection
        if (document.getCurrentVersion() > lock.getVersionAtLock()) {
            log.info("Version conflict: documentId={}, lockedVersion={}, currentVersion={}",
                    documentId, lock.getVersionAtLock(), document.getCurrentVersion());
            return OnlyOfficeCallbackResponse.conflict(
                    "A newer version has been uploaded. Please resolve the conflict before saving.",
                    documentId);
        }

        // Replace localhost:8888 with the internal Docker service name and nginx port.
        // OnlyOffice nginx listens on port 80 inside the container (port 8888 is the host mapping).
        String downloadUrl = savedFileUrl
                .replace("localhost:8888", "onlyoffice-document-server:80")
                .replace("127.0.0.1:8888", "onlyoffice-document-server:80");
        log.info("Downloading saved file from DocumentServer: {}", downloadUrl);
        byte[] fileBytes;
        try {
            fileBytes = downloadFromUrl(downloadUrl);
        } catch (Exception ex) {
            log.error("Failed to download file from DocumentServer: {}", ex.getMessage(), ex);
            return OnlyOfficeCallbackResponse.error("Failed to download saved file: " + ex.getMessage(), documentId);
        }

        int oldVersion = document.getCurrentVersion();
        String newFileKey = storageService.uploadFile(fileBytes,
                document.getOriginalFilename() != null ? document.getOriginalFilename() : "document.docx",
                documentId);
        int newVersionNumber = document.getCurrentVersion() + 1;

        DocumentVersion version = DocumentVersion.builder()
                .id(UUID.randomUUID())
                .documentId(documentId)
                .versionNumber(newVersionNumber)
                .fileKey(newFileKey)
                .fileSizeBytes((long) fileBytes.length)
                .changelog("Edited via OnlyOffice")
                .createdBy(lock.getLockedBy())
                .createdAt(OffsetDateTime.now())
                .build();
        versionRepository.save(version);

        document.setCurrentVersion(newVersionNumber);
        document.setFileKey(newFileKey);
        document.setFileSizeBytes((long) fileBytes.length);
        document.setUpdatedAt(OffsetDateTime.now());
        documentRepository.save(document);

        lockRepository.delete(lock);

        log.info("OnlyOffice save callback (from URL) processed: documentId={}, newVersion={}",
                documentId, newVersionNumber);
        logAudit(documentId, "ONLYOFFICE_SAVE_SUCCESS",
                Map.of("oldVersion", oldVersion),
                Map.of("newVersion", newVersionNumber, "fileKey", newFileKey), lock.getLockedBy());
        return OnlyOfficeCallbackResponse.success(newVersionNumber, documentId);
    }

    private byte[] downloadFromUrl(String urlString) throws Exception {
        java.net.URI uri = java.net.URI.create(urlString);
        java.net.URL url = uri.toURL();
        java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
        conn.setConnectTimeout(10_000);
        conn.setReadTimeout(30_000);
        conn.setRequestProperty("User-Agent", "Poliwise/1.0");
        try (java.io.InputStream is = conn.getInputStream()) {
            return is.readAllBytes();
        }
    }

    /**
     * Manual save triggered by user clicking "Lưu phiên bản mới".
     * Frontend downloads the file via OnlyOffice SDK downloadAs() and uploads it here.
     * Detects version conflicts and creates a new version on success.
     */
    @Transactional
    public SaveResult saveDocument(UUID documentId, UUID userId, MultipartFile file) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        Optional<DocumentLock> lockOpt = lockRepository.findByDocumentId(documentId);
        if (lockOpt.isEmpty()) {
            throw new IllegalStateException("No active lock found. Please open the editor again.");
        }

        DocumentLock lock = lockOpt.get();
        if (!lock.isOwnedBy(userId)) {
            throw new SecurityException("You do not own the lock for this document.");
        }

        if (lock.isExpired()) {
            throw new IllegalStateException("Lock has expired. Please re-acquire the lock.");
        }

        // Conflict detection
        if (document.getCurrentVersion() > lock.getVersionAtLock()) {
            throw new ConflictException(
                    "A newer version has been uploaded while you were editing. Please resolve the conflict.",
                    lock.getVersionAtLock(),
                    document.getCurrentVersion());
        }

        // Safe to save
        int oldVersion = document.getCurrentVersion();
        String newFileKey = storageService.uploadFile(file, documentId);
        int newVersionNumber = document.getCurrentVersion() + 1;

        DocumentVersion version = DocumentVersion.builder()
                .id(UUID.randomUUID())
                .documentId(documentId)
                .versionNumber(newVersionNumber)
                .fileKey(newFileKey)
                .fileSizeBytes(file.getSize())
                .changelog("Edited via OnlyOffice")
                .createdBy(userId)
                .createdAt(OffsetDateTime.now())
                .build();
        versionRepository.save(version);

        document.setCurrentVersion(newVersionNumber);
        document.setFileKey(newFileKey);
        document.setFileSizeBytes(file.getSize());
        document.setUpdatedAt(OffsetDateTime.now());
        documentRepository.save(document);

        // Release lock after successful save
        lockRepository.delete(lock);

        log.info("Manual save: documentId={}, newVersion={}, oldVersion={}", documentId, newVersionNumber, oldVersion);
        logAudit(documentId, "ONLYOFFICE_MANUAL_SAVE",
                Map.of("oldVersion", oldVersion),
                Map.of("newVersion", newVersionNumber), userId);

        return new SaveResult(newVersionNumber);
    }

    public record SaveResult(int newVersion) {}

    public static class ConflictException extends RuntimeException {
        private final int lockedVersion;
        private final int currentVersion;
        public ConflictException(String message, int lockedVersion, int currentVersion) {
            super(message);
            this.lockedVersion = lockedVersion;
            this.currentVersion = currentVersion;
        }
        public int getLockedVersion() { return lockedVersion; }
        public int getCurrentVersion() { return currentVersion; }
        public int lockedVersion() { return lockedVersion; }
        public int currentVersion() { return currentVersion; }
    }

    // ========== Conflict Detection ==========

    /**
     * Check conflict status for a document lock.
     * Returns detailed conflict info if a newer version was uploaded while editing.
     */
    public ConflictStatusResponse getConflictStatus(UUID documentId, UUID userId) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        Optional<DocumentLock> lockOpt = lockRepository.findByDocumentId(documentId);

        if (lockOpt.isEmpty()) {
            return new ConflictStatusResponse(
                    false, documentId, 0, document.getCurrentVersion(),
                    null, null, "No active lock", null);
        }

        DocumentLock lock = lockOpt.get();

        if (!lock.isOwnedBy(userId)) {
            return new ConflictStatusResponse(
                    false, documentId, lock.getVersionAtLock(), document.getCurrentVersion(),
                    lock.getLockedBy(), lock.getLockedByUsername(),
                    "Document is being edited by: " + (lock.getLockedByUsername() != null ? lock.getLockedByUsername() : lock.getLockedBy().toString()),
                    null);
        }

        if (document.getCurrentVersion() > lock.getVersionAtLock()) {
            // Conflict — fetch the newer version's info
            DocumentVersion theirVersion = versionRepository
                    .findByDocumentIdAndVersionNumber(documentId, document.getCurrentVersion())
                    .orElse(null);

            String theirContent = theirVersion != null ? theirVersion.getExtractedText() : "";
            String baseContent = getVersionText(documentId, lock.getVersionAtLock());

            return new ConflictStatusResponse(
                    true, documentId, lock.getVersionAtLock(), document.getCurrentVersion(),
                    lock.getLockedBy(), lock.getLockedByUsername(),
                    "A newer version has been uploaded while you were editing. Please resolve the conflict.",
                    new VersionDiffInfo(baseContent, theirContent,
                            theirVersion != null ? theirVersion.getChangelog() : "",
                            theirVersion != null ? theirVersion.getCreatedAt() : null,
                            theirVersion != null ? theirVersion.getCreatedBy().toString() : null)
            );
        }

        return new ConflictStatusResponse(
                false, documentId, lock.getVersionAtLock(), document.getCurrentVersion(),
                userId, lock.getLockedByUsername(), "No conflict", null);
    }

    // ========== Version Diff ==========

    /**
     * Compute line-by-line diff between two versions.
     * Uses java-diff-utils for TXT/MD files.
     * For DOCX, compares extracted text.
     */
    public VersionDiffResponse computeVersionDiff(UUID documentId, int baseVersion, int compareVersion) {
        String baseContent = getVersionText(documentId, baseVersion);
        String compareContent = getVersionText(documentId, compareVersion);

        List<String> baseLines = Arrays.asList(baseContent.split("\n"));
        List<String> compareLines = Arrays.asList(compareContent.split("\n"));

        Patch<String> patch = DiffUtils.diff(baseLines, compareLines);

        List<VersionDiffResponse.DiffLine> diffLines = new ArrayList<>();
        int baseLineNum = 1;
        int compareLineNum = 1;
        int additions = 0;
        int deletions = 0;

        for (AbstractDelta<String> delta : patch.getDeltas()) {
            DeltaType type = delta.getType();

            if (type == DeltaType.DELETE) {
                for (String line : delta.getSource().getLines()) {
                    diffLines.add(new VersionDiffResponse.DiffLine(
                            VersionDiffResponse.DiffType.DELETED, baseLineNum++, line));
                    deletions++;
                }
            } else if (type == DeltaType.INSERT) {
                for (String line : delta.getTarget().getLines()) {
                    diffLines.add(new VersionDiffResponse.DiffLine(
                            VersionDiffResponse.DiffType.ADDED, compareLineNum++, line));
                    additions++;
                }
            } else if (type == DeltaType.CHANGE) {
                for (String line : delta.getSource().getLines()) {
                    diffLines.add(new VersionDiffResponse.DiffLine(
                            VersionDiffResponse.DiffType.DELETED, baseLineNum++, line));
                    deletions++;
                }
                for (String line : delta.getTarget().getLines()) {
                    diffLines.add(new VersionDiffResponse.DiffLine(
                            VersionDiffResponse.DiffType.ADDED, compareLineNum++, line));
                    additions++;
                }
            }
        }

        return new VersionDiffResponse(
                documentId, baseVersion, compareVersion,
                baseContent, compareContent,
                diffLines, additions, deletions);
    }

    // ========== Conflict Resolution ==========

    /**
     * Resolve a version conflict.
     * Supports three strategies:
     * - "merge_as_new": Upload the merged file as a new version
     * - "discard_mine": Discard my changes, keep their version
     * - "force_push": Overwrite the current version (ADMIN only)
     */
    @Transactional
    public DocumentVersion resolveConflict(
            UUID documentId,
            ConflictResolutionRequest request,
            MultipartFile file,
            UUID userId,
            boolean isAdmin) {

        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        DocumentLock lock = lockRepository.findByDocumentId(documentId)
                .orElseThrow(() -> new IllegalStateException("No active lock found"));

        if (!lock.matchesToken(request.lockToken()) && !isAdmin) {
            throw new SecurityException("Invalid lock token");
        }

        return switch (request.strategy()) {
            case "merge_as_new" -> {
                int lockedVersion = lock.getVersionAtLock();
                DocumentVersion result = saveAsNewVersion(documentId, file, request.mergedChangelog(), userId, lock);
                logAudit(documentId, "ONLYOFFICE_CONFLICT_RESOLVED",
                        Map.of("strategy", "merge_as_new", "lockedVersion", lockedVersion),
                        Map.of("newVersion", result.getVersionNumber()), userId);
                yield result;
            }
            case "discard_mine" -> {
                int lockedVersion = lock.getVersionAtLock();
                int currentVersion = document.getCurrentVersion();
                lockRepository.delete(lock);
                logAudit(documentId, "ONLYOFFICE_CONFLICT_RESOLVED",
                        Map.of("strategy", "discard_mine", "lockedVersion", lockedVersion),
                        Map.of("currentVersion", currentVersion), userId);
                yield null;
            }
            case "force_push" -> {
                if (!isAdmin) {
                    throw new SecurityException("Only ADMIN can force-push");
                }
                int lockedVersion = lock.getVersionAtLock();
                DocumentVersion result = forcePush(documentId, file, userId, lock);
                logAudit(documentId, "ONLYOFFICE_CONFLICT_RESOLVED",
                        Map.of("strategy", "force_push", "lockedVersion", lockedVersion),
                        Map.of("newVersion", result.getVersionNumber()), userId);
                yield result;
            }
            default -> throw new IllegalArgumentException("Unknown conflict resolution strategy: " + request.strategy());
        };
    }

    private DocumentVersion saveAsNewVersion(UUID documentId, MultipartFile file,
                                              String changelog, UUID userId, DocumentLock lock) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found"));

        String newFileKey = storageService.uploadFile(file, documentId);
        int newVersionNumber = document.getCurrentVersion() + 1;

        DocumentVersion version = DocumentVersion.builder()
                .id(UUID.randomUUID())
                .documentId(documentId)
                .versionNumber(newVersionNumber)
                .fileKey(newFileKey)
                .fileSizeBytes(file.getSize())
                .changelog(changelog != null ? changelog : "Merged via conflict resolution")
                .createdBy(userId)
                .createdAt(OffsetDateTime.now())
                .build();
        DocumentVersion saved = versionRepository.save(version);

        document.setCurrentVersion(newVersionNumber);
        document.setFileKey(newFileKey);
        document.setFileSizeBytes(file.getSize());
        document.setUpdatedAt(OffsetDateTime.now());
        documentRepository.save(document);

        // Keep lock for potential next edit
        lock.setExpiresAt(OffsetDateTime.now().plusMinutes(properties.getLockDurationMinutes()));
        lockRepository.save(lock);

        log.info("Conflict resolved (merge_as_new): documentId={}, newVersion={}", documentId, newVersionNumber);
        return saved;
    }

    private DocumentVersion forcePush(UUID documentId, MultipartFile file, UUID userId, DocumentLock lock) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found"));

        String newFileKey = storageService.uploadFile(file, documentId);
        int newVersionNumber = document.getCurrentVersion() + 1;

        DocumentVersion version = DocumentVersion.builder()
                .id(UUID.randomUUID())
                .documentId(documentId)
                .versionNumber(newVersionNumber)
                .fileKey(newFileKey)
                .fileSizeBytes(file.getSize())
                .changelog("Force-pushed (overwritten latest version)")
                .createdBy(userId)
                .createdAt(OffsetDateTime.now())
                .build();
        DocumentVersion saved = versionRepository.save(version);

        document.setCurrentVersion(newVersionNumber);
        document.setFileKey(newFileKey);
        document.setFileSizeBytes(file.getSize());
        document.setUpdatedAt(OffsetDateTime.now());
        documentRepository.save(document);

        lockRepository.delete(lock);

        log.info("Force-push: documentId={}, newVersion={}", documentId, newVersionNumber);
        return saved;
    }

    // ========== Version Deletion ==========

    /**
     * Delete a specific version (ADMIN only).
     * Cannot delete the last remaining version.
     */
    @Transactional
    public void deleteVersion(UUID documentId, int versionNumber, UUID deletedBy, String reason) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        if (document.getCurrentVersion() == 1 && versionNumber == 1) {
            throw new IllegalStateException("Cannot delete the only version of a document");
        }

        DocumentVersion version = versionRepository.findByDocumentIdAndVersionNumber(documentId, versionNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Version not found: " + versionNumber));

        if (document.getCurrentVersion() == versionNumber) {
            throw new IllegalStateException("Cannot delete the latest version. Upload a new version first.");
        }

        // Archive the version before deletion
        DocumentVersionDeletion archive = DocumentVersionDeletion.builder()
                .id(UUID.randomUUID())
                .documentId(documentId)
                .versionNumber(versionNumber)
                .deletedBy(deletedBy)
                .deletedAt(OffsetDateTime.now())
                .fileKey(version.getFileKey())
                .fileSizeBytes(version.getFileSizeBytes())
                .changelog(version.getChangelog())
                .extractedText(version.getExtractedText())
                .build();
        deletionRepository.save(archive);

        versionRepository.delete(version);
        log.info("Version deleted: documentId={}, version={}, archivedBy={}", documentId, versionNumber, deletedBy);
        logAudit(documentId, "ONLYOFFICE_VERSION_DELETED",
                Map.of("versionNumber", versionNumber, "fileKey", version.getFileKey()),
                Map.of("reason", reason != null ? reason : ""), deletedBy);
    }

    // ========== Helpers ==========

    /**
     * Return the latest version metadata and a presigned download URL.
     * Used by the frontend to preview the newest version during conflict resolution.
     */
    public FetchLatestVersionResponse fetchLatestVersion(UUID documentId) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        DocumentVersion latestVersion = versionRepository
                .findByDocumentIdAndVersionNumber(documentId, document.getCurrentVersion())
                .orElseThrow(() -> new ResourceNotFoundException("Version not found: " + document.getCurrentVersion()));

        String downloadUrl = storageService.getFileUrl(latestVersion.getFileKey());

        return new FetchLatestVersionResponse(
                documentId,
                latestVersion.getId(),
                latestVersion.getVersionNumber(),
                latestVersion.getChangelog(),
                latestVersion.getCreatedBy(),
                null,
                latestVersion.getCreatedAt(),
                latestVersion.getFileSizeBytes(),
                downloadUrl
        );
    }

    /**
     * Stream the document file directly to the response.
     * Used by the /file proxy endpoint to serve documents to OnlyOffice DS
     * without relying on presigned URLs (avoids MinIO/AWS v4 Host-header signature mismatch).
     * Uses the version captured at lock time so OnlyOffice always opens the correct file.
     */
    public void streamFileToResponse(UUID documentId, jakarta.servlet.http.HttpServletResponse response) throws Exception {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        String fileKey;
        String filename;
        long fileSize;

        // Use the version captured when the lock was acquired (versionAtLock).
        // This ensures OnlyOffice always opens the correct file snapshot, not the latest.
        Optional<DocumentLock> lockOpt = lockRepository.findByDocumentId(documentId);
        if (lockOpt.isPresent() && !lockOpt.get().isExpired()) {
            DocumentLock lock = lockOpt.get();
            DocumentVersion versionAtLock = versionRepository
                    .findByDocumentIdAndVersionNumber(documentId, lock.getVersionAtLock())
                    .orElse(null);
            if (versionAtLock != null) {
                fileKey = versionAtLock.getFileKey();
                filename = document.getOriginalFilename() != null ? document.getOriginalFilename() : "document";
                fileSize = versionAtLock.getFileSizeBytes() != null ? versionAtLock.getFileSizeBytes() : 0;
            } else {
                fileKey = document.getFileKey();
                filename = document.getOriginalFilename() != null ? document.getOriginalFilename() : "document";
                fileSize = document.getFileSizeBytes() != null ? document.getFileSizeBytes() : 0;
            }
        } else {
            fileKey = document.getFileKey();
            filename = document.getOriginalFilename() != null ? document.getOriginalFilename() : "document";
            fileSize = document.getFileSizeBytes() != null ? document.getFileSizeBytes() : 0;
        }

        String mimeType = document.getMimeType() != null ? document.getMimeType() : "application/octet-stream";

        response.setContentType(mimeType);
        response.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
        response.setHeader("Content-Length", String.valueOf(fileSize));

        try (InputStream is = storageService.downloadFile(fileKey)) {
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = is.read(buffer)) != -1) {
                response.getOutputStream().write(buffer, 0, bytesRead);
            }
            response.getOutputStream().flush();
        }
    }

    private void logAudit(UUID documentId, String action, Map<String, Object> oldValues,
                          Map<String, Object> newValues, UUID actorId) {
        try {
            DocumentAuditLog auditLog = DocumentAuditLog.builder()
                    .id(UUID.randomUUID())
                    .documentId(documentId)
                    .action(action)
                    .actorId(actorId)
                    .actorUsername(null)
                    .oldValues(oldValues)
                    .newValues(newValues)
                    .createdAt(OffsetDateTime.now())
                    .build();
            auditLogRepository.save(auditLog);
        } catch (Exception e) {
            OnlyOfficeService.log.error("Failed to log audit: {}", e.getMessage(), e);
        }
    }

    private String getVersionText(UUID documentId, int versionNumber) {
        if (versionNumber == 0) {
            Document document = documentRepository.findById(documentId).orElse(null);
            return document != null && document.getExtractedText() != null
                    ? document.getExtractedText() : "";
        }
        return versionRepository.findByDocumentIdAndVersionNumber(documentId, versionNumber)
                .map(v -> v.getExtractedText() != null ? v.getExtractedText() : "")
                .orElse("");
    }

    private String mapToOnlyOfficeDocumentType(String fileType) {
        return switch (fileType.toLowerCase()) {
            case "docx", "doc" -> "word";
            case "xlsx", "xls" -> "cell";
            case "pptx", "ppt" -> "slide";
            case "txt", "md" -> "text";
            default -> "word";
        };
    }

    private LockResponse toLockResponse(DocumentLock lock) {
        return new LockResponse(
                lock.getDocumentId(),
                lock.getLockedBy(),
                lock.getLockedByUsername(),
                lock.getVersionAtLock(),
                lock.getLockToken().toString(),
                lock.getLockedAt(),
                lock.getExpiresAt()
        );
    }
}
