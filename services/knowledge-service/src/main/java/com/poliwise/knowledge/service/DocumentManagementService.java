package com.poliwise.knowledge.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.poliwise.knowledge.dto.*;
import com.poliwise.knowledge.entity.Document;
import com.poliwise.knowledge.entity.DocumentAuditLog;
import com.poliwise.knowledge.entity.DocumentVersion;
import com.poliwise.knowledge.client.MetadataServiceClient;
import com.poliwise.knowledge.enums.ChunkingStrategy;
import com.poliwise.knowledge.enums.EmbeddingModel;
import com.poliwise.knowledge.enums.ProcessingStatus;
import com.poliwise.knowledge.event.DocumentEventPublisher;
import com.poliwise.knowledge.repository.DocumentAuditLogRepository;
import com.poliwise.knowledge.repository.DocumentRepository;
import com.poliwise.knowledge.repository.DocumentSpecifications;
import com.poliwise.knowledge.repository.DocumentVersionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import com.poliwise.knowledge.exception.ResourceNotFoundException;

import java.io.InputStream;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class DocumentManagementService {

    private static final Logger log = LoggerFactory.getLogger(DocumentManagementService.class);

    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository versionRepository;
    private final DocumentAuditLogRepository auditLogRepository;
    private final StorageService storageService;
    private final DocumentEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;
    private final MetadataServiceClient metadataServiceClient;

    public DocumentManagementService(
            DocumentRepository documentRepository,
            DocumentVersionRepository versionRepository,
            DocumentAuditLogRepository auditLogRepository,
            StorageService storageService,
            DocumentEventPublisher eventPublisher,
            ObjectMapper objectMapper,
            MetadataServiceClient metadataServiceClient) {
        this.documentRepository = documentRepository;
        this.versionRepository = versionRepository;
        this.auditLogRepository = auditLogRepository;
        this.storageService = storageService;
        this.eventPublisher = eventPublisher;
        this.objectMapper = objectMapper;
        this.metadataServiceClient = metadataServiceClient;
    }

    // ========== Document CRUD ==========

    @Transactional
    public Document upload(MultipartFile file, UploadDocumentRequest request, UUID uploadedBy, String ipAddress, String userAgent) {
        // 1. Validate file
        validateFile(file);

        // 2. Generate document ID
        UUID documentId = UUID.randomUUID();

        // 3. Upload to MinIO
        String fileKey = storageService.uploadFile(file, documentId);

        // 4. Create document entity
        Document document = createDocumentEntity(documentId, fileKey, file, request, uploadedBy);

        // 5. Create first version
        createVersion(documentId, fileKey, file.getSize(), "Initial upload", null, uploadedBy);

        // 6. Audit log
        logAudit(documentId, "UPLOAD", null, Map.of(
                "originalFilename", document.getOriginalFilename(),
                "fileType", document.getFileType().toString(),
                "fileSizeBytes", document.getFileSizeBytes()
        ), uploadedBy, ipAddress, userAgent);

        // 7. Publish event
        publishDocumentUploaded(document);

        log.info("Document uploaded: id={}, fileName={}", documentId, document.getOriginalFilename());
        return document;
    }

    @Transactional
    public Document uploadNewVersion(UUID documentId, MultipartFile file, String changelog, UUID uploadedBy, String ipAddress, String userAgent) {
        // 1. Lock document for update (prevent race condition)
        Document document = documentRepository.findByIdForUpdate(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        if (document.getDeletedAt() != null) {
            throw new IllegalStateException("Cannot upload new version for deleted document");
        }

        // 2. Validate file
        validateFile(file);

        // 3. Upload new file to MinIO
        String newFileKey = storageService.uploadFile(file, documentId);

        // 4. Increment version
        int newVersionNumber = document.getCurrentVersion() + 1;

        // 5. Create new version record
        DocumentVersion version = createVersion(
                documentId,
                newFileKey,
                file.getSize(),
                changelog != null ? changelog : "Version " + newVersionNumber,
                newVersionNumber,
                uploadedBy
        );

        // 6. Update document
        document.setCurrentVersion(newVersionNumber);
        document.setOriginalFilename(Objects.requireNonNullElse(file.getOriginalFilename(), document.getOriginalFilename()));
        document.setFileSizeBytes(file.getSize());
        document.setUpdatedAt(OffsetDateTime.now());
        documentRepository.save(document);

        // 7. Audit log
        logAudit(documentId, "VERSION_CREATED", Map.of("version", document.getCurrentVersion() - 1), Map.of(
                "version", newVersionNumber,
                "fileKey", newFileKey,
                "changelog", changelog
        ), uploadedBy, ipAddress, userAgent);

        log.info("New version created: documentId={}, version={}", documentId, newVersionNumber);
        return document;
    }

    public Page<Document> searchDocuments(DocumentSearchRequest request) {
        Specification<Document> spec = DocumentSpecifications.buildSpecification(
                request.search(),
                request.fileType() != null ? request.fileType().toString() : null,
                request.uploadedBy() != null ? request.uploadedBy().toString() : null,
                request.startDate(),
                request.endDate(),
                request.status()
        );

        Sort sort = Sort.by(
                request.sortOrder() != null && request.sortOrder().equalsIgnoreCase("asc")
                        ? Sort.Direction.ASC : Sort.Direction.DESC,
                request.sortBy() != null ? request.sortBy() : "createdAt"
        );

        Pageable pageable = PageRequest.of(request.page() - 1, request.size(), sort);
        return documentRepository.findAll(spec, pageable);
    }

    public DocumentDetailResponse getDocumentDetail(UUID documentId) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        List<DocumentVersion> versions = versionRepository.findByDocumentIdOrderByVersionNumberDesc(documentId);

        String downloadUrl = storageService.getFileUrl(document.getFileKey());

        return new DocumentDetailResponse(
                document.getId(),
                document.getOriginalFilename(),
                document.getFileType() != null ? document.getFileType().toString() : null,
                document.getFileSizeBytes(),
                document.getMimeType(),
                document.getStatus() != null ? document.getStatus().toString() : null,
                document.getCurrentVersion(),
                document.getPageCount(),
                document.getWordCount(),
                document.getLanguage(),
                document.getBucketName(),
                document.getFileKey(),
                downloadUrl,
                document.getUploadedBy(),
                document.getCreatedAt(),
                document.getUpdatedAt(),
                versions.stream()
                        .map(v -> new DocumentVersionResponse(
                                v.getId(), v.getDocumentId(), v.getVersionNumber(),
                                v.getFileKey(), v.getFileSizeBytes(), v.getChangelog(),
                                v.getCreatedBy(), v.getCreatedAt()
                        ))
                        .collect(Collectors.toList())
        );
    }

    @Transactional
    public void cancelUpload(UUID documentId, UUID cancelledBy, String ipAddress, String userAgent) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        if (document.getStatus() != ProcessingStatus.STAGING) {
            throw new IllegalStateException("Document is not in staging status: " + document.getStatus());
        }

        // Audit before deletion
        logAudit(documentId, "CANCEL_UPLOAD", Map.of("status", document.getStatus().toString()), null,
                cancelledBy, ipAddress, userAgent);

        // Delete all versions from MinIO
        List<DocumentVersion> versions = versionRepository.findByDocumentIdOrderByVersionNumberDesc(documentId);
        for (DocumentVersion version : versions) {
            try {
                storageService.deleteFile(version.getFileKey());
            } catch (Exception e) {
                log.warn("Failed to delete file from MinIO: fileKey={}, error={}", version.getFileKey(), e.getMessage());
            }
        }

        // Delete version records
        versionRepository.deleteAll(versions);

        // Delete document record
        documentRepository.delete(document);

        log.info("Upload cancelled: id={}", documentId);
    }

    @Transactional
    public void softDelete(UUID documentId, UUID deletedBy, String ipAddress, String userAgent) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        if (document.getDeletedAt() != null) {
            throw new IllegalStateException("Document is already deleted");
        }

        OffsetDateTime now = OffsetDateTime.now();
        document.setDeletedAt(now);
        document.setUpdatedAt(now);
        documentRepository.save(document);

        // Audit log
        logAudit(documentId, "SOFT_DELETE", Map.of("status", document.getStatus().toString()), Map.of("deletedAt", now.toString()),
                deletedBy, ipAddress, userAgent);

        // Publish deletion event
        eventPublisher.publishDocumentDeleted(
                com.poliwise.knowledge.dto.event.DocumentDeletedEvent.create(documentId, deletedBy)
        );

        log.info("Document soft deleted: id={}", documentId);
    }

    public StreamingResponseBody downloadDocument(UUID documentId) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        if (document.getDeletedAt() != null) {
            throw new IllegalStateException("Document has been deleted");
        }

        InputStream fileStream = storageService.downloadFile(document.getFileKey());

        return outputStream -> {
            try (InputStream is = fileStream) {
                byte[] buffer = new byte[8192];
                int bytesRead;
                while ((bytesRead = is.read(buffer)) != -1) {
                    outputStream.write(buffer, 0, bytesRead);
                }
            }
        };
    }

    public byte[] getDocumentBytes(UUID documentId) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        if (document.getDeletedAt() != null) {
            throw new IllegalStateException("Document has been deleted");
        }

        try (InputStream is = storageService.downloadFile(document.getFileKey())) {
            return is.readAllBytes();
        } catch (Exception e) {
            throw new RuntimeException("Failed to read document bytes: " + e.getMessage(), e);
        }
    }

    public String getDownloadUrl(UUID documentId) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        if (document.getDeletedAt() != null) {
            throw new IllegalStateException("Document has been deleted");
        }

        return storageService.getFileUrl(document.getFileKey());
    }

    public StreamingResponseBody downloadVersion(UUID documentId, Integer versionNumber) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        DocumentVersion version = versionRepository.findByDocumentIdAndVersionNumber(documentId, versionNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Version not found: " + versionNumber));

        InputStream fileStream = storageService.downloadFile(version.getFileKey());

        return outputStream -> {
            try (InputStream is = fileStream) {
                byte[] buffer = new byte[8192];
                int bytesRead;
                while ((bytesRead = is.read(buffer)) != -1) {
                    outputStream.write(buffer, 0, bytesRead);
                }
            }
        };
    }

    // ========== Audit Logs ==========

    public Page<DocumentAuditLogResponse> getAuditLogs(UUID documentId, UUID actorId, String action,
                                                        LocalDate startDate, LocalDate endDate,
                                                        int page, int size) {
        OffsetDateTime start = startDate != null
                ? startDate.atStartOfDay().atZone(java.time.ZoneOffset.UTC).toOffsetDateTime()
                : null;
        OffsetDateTime end = endDate != null
                ? endDate.plusDays(1).atStartOfDay().atZone(java.time.ZoneOffset.UTC).toOffsetDateTime()
                : null;

        Pageable pageable = PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<DocumentAuditLog> logs = auditLogRepository.searchAuditLogs(documentId, actorId, action, start, end, pageable);

        return logs.map(log -> new DocumentAuditLogResponse(
                log.getId(),
                log.getDocumentId(),
                log.getAction(),
                log.getActorId(),
                log.getActorUsername(),
                parseJson(log.getOldValues()),
                parseJson(log.getNewValues()),
                log.getIpAddress(),
                log.getCreatedAt()
        ));
    }

    // ========== Private Helper Methods ==========

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is required and cannot be empty");
        }

        String filename = file.getOriginalFilename();
        if (filename == null || filename.isBlank()) {
            throw new IllegalArgumentException("File name is required");
        }

        long maxSize = 100 * 1024 * 1024L; // 100MB
        if (file.getSize() > maxSize) {
            throw new IllegalArgumentException("File size exceeds maximum allowed size of 100MB");
        }

        String lower = filename.toLowerCase();
        Set<String> allowedExtensions = Set.of(".pdf", ".docx", ".doc", ".xlsx", ".xls", ".txt", ".png", ".jpg", ".jpeg", ".md");
        boolean validExtension = allowedExtensions.stream().anyMatch(lower::endsWith);
        if (!validExtension) {
            throw new IllegalArgumentException("Unsupported file type. Allowed: PDF, DOCX, DOC, XLSX, XLS, TXT, PNG, JPG, JPEG, MD");
        }
    }

    private Document createDocumentEntity(UUID documentId, String fileKey, MultipartFile file,
                                          UploadDocumentRequest request, UUID uploadedBy) {
        OffsetDateTime now = OffsetDateTime.now();

        Document document = Document.builder()
                .id(documentId)
                .originalFilename(request.fileName())
                .fileType(request.fileType())
                .fileSizeBytes(request.fileSizeBytes())
                .mimeType(request.mimeType() != null ? request.mimeType() : "application/octet-stream")
                .fileKey(fileKey)
                .bucketName("poliwise-documents")
                .status(ProcessingStatus.STAGING)
                .currentVersion(1)
                .language(request.language() != null ? request.language() : "vi")
                .chunkingStrategy(ChunkingStrategy.SENTENCE)
                .chunkSize(512)
                .chunkOverlap(50)
                .embeddingModel(EmbeddingModel.MULTILINGUAL_E5_LARGE)
                .uploadedBy(uploadedBy)
                .expiresAt(now.plusHours(24))
                .createdAt(now)
                .updatedAt(now)
                .build();

        return documentRepository.save(document);
    }

    private DocumentVersion createVersion(UUID documentId, String fileKey, Long fileSizeBytes,
                                          String changelog, Integer versionNumber, UUID createdBy) {
        OffsetDateTime now = OffsetDateTime.now();

        // Get current version count
        int newVersionNumber = versionNumber != null ? versionNumber :
                versionRepository.findByDocumentIdOrderByVersionNumberDesc(documentId)
                        .stream()
                        .findFirst()
                        .map(v -> v.getVersionNumber() + 1)
                        .orElse(1);

        DocumentVersion version = DocumentVersion.builder()
                .id(UUID.randomUUID())
                .documentId(documentId)
                .versionNumber(newVersionNumber)
                .fileKey(fileKey)
                .fileSizeBytes(fileSizeBytes)
                .changelog(changelog)
                .createdBy(createdBy)
                .createdAt(now)
                .build();

        return versionRepository.save(version);
    }

    private void logAudit(UUID documentId, String action, Map<String, Object> oldValues,
                          Map<String, Object> newValues, UUID actorId,
                          String ipAddress, String userAgent) {
        try {
            DocumentAuditLog auditLog = DocumentAuditLog.builder()
                    .id(UUID.randomUUID())
                    .documentId(documentId)
                    .action(action)
                    .actorId(actorId)
                    .actorUsername(null)
                    .oldValues(oldValues)
                    .newValues(newValues)
                    .ipAddress(ipAddress)
                    .userAgent(userAgent)
                    .createdAt(OffsetDateTime.now())
                    .build();
            auditLogRepository.save(auditLog);
        } catch (Exception e) {
            log.error("Failed to log audit: {}", e.getMessage(), e);
        }
    }

    private Object parseJson(Object json) {
        if (json == null) return null;
        return json;
    }

    private void publishDocumentUploaded(Document document) {
        try {
            com.poliwise.knowledge.dto.event.DocumentUploadedEvent event =
                    com.poliwise.knowledge.dto.event.DocumentUploadedEvent.create(
                            document.getId(),
                            document.getOriginalFilename(),
                            document.getFileType(),
                            document.getFileSizeBytes(),
                            document.getFileKey(),
                            document.getUploadedBy(),
                            document.getChunkingStrategy(),
                            document.getEmbeddingModel()
                    );
            eventPublisher.publishDocumentUploaded(event);
        } catch (Exception e) {
            log.error("Failed to publish document uploaded event: {}", e.getMessage(), e);
        }
    }

    /**
     * Phase 1: Confirm user-reviewed metadata and persist it in metadata-service.
     * Updates document language and status to READY.
     * Phase 2 (ingestion) is NOT triggered here.
     */
    @Transactional
    public Document confirmMetadata(UUID documentId, DocumentConfirmRequest request, UUID confirmedBy) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        if (document.getStatus() != ProcessingStatus.STAGING && document.getStatus() != ProcessingStatus.READY) {
            throw new IllegalStateException("Document is not in staging or ready status: " + document.getStatus());
        }

        // 1. Resolve category slug → UUID
        UUID categoryId = metadataServiceClient.resolveCategorySlug(request.categorySlug());
        if (request.categorySlug() != null && !request.categorySlug().isBlank() && categoryId == null) {
            log.warn("Category resolution failed for slug: {}", request.categorySlug());
        }

        // 2. Resolve tag names → UUIDs (find existing or create new)
        List<UUID> tagIds = metadataServiceClient.resolveTagNames(request.tags());

        // 3. Create document_metadata record in metadata-service
        try {
            metadataServiceClient.createDocumentMetadata(
                    documentId,
                    request.title(),
                    request.description(),
                    categoryId,
                    tagIds,
                    request.isPolicy()
            );
        } catch (RuntimeException e) {
            log.error("Failed to persist metadata to metadata-service: {}", e.getMessage());
            throw new RuntimeException("Failed to save metadata: " + e.getMessage(), e);
        }

        // 4. Update document language, status, and clear expiresAt
        if (request.language() != null) {
            document.setLanguage(request.language());
        }
        document.setStatus(ProcessingStatus.READY);
        document.setExpiresAt(null);
        document.setUpdatedAt(OffsetDateTime.now());
        Document saved = documentRepository.save(document);

        log.info("Document metadata confirmed: documentId={}, title='{}', categorySlug='{}'",
                documentId, request.title(), request.categorySlug());

        // Phase 2: Trigger Ingestion automatically after confirmation
        try {
            triggerIngestion(saved.getId(), confirmedBy);
        } catch (Exception e) {
            log.error("Failed to auto-trigger ingestion for document {}: {}", documentId, e.getMessage());
        }

        return saved;
    }

    /**
     * Get extracted text for a specific document version.
     */
    public String getExtractedText(UUID documentId, Integer versionNumber) {
        DocumentVersion version = versionRepository.findByDocumentIdAndVersionNumber(documentId, versionNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Document version not found: " + documentId + " v" + versionNumber));
        return version.getExtractedText();
    }

    /**
     * Trigger the ingestion pipeline by publishing an ingestion.requested event.
     */
    public void triggerIngestion(UUID documentId, UUID triggeredBy) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        // Get latest version ID
        List<DocumentVersion> versions = versionRepository.findByDocumentIdOrderByVersionNumberDesc(documentId);
        if (versions.isEmpty()) {
            throw new IllegalStateException("No versions found for document: " + documentId);
        }
        DocumentVersion latestVersion = versions.get(0);
        UUID latestVersionId = latestVersion.getId();
        Integer versionNumber = latestVersion.getVersionNumber();

        // Generate a new job ID for tracking
        UUID jobId = UUID.randomUUID();

        // Prepare payload for Python ingestion-service
        Map<String, Object> payload = new HashMap<>();
        payload.put("job_id", jobId.toString());
        payload.put("document_id", documentId.toString());
        payload.put("document_version_id", latestVersionId.toString());
        payload.put("document_version", versionNumber);
        payload.put("file_key", document.getFileKey());
        payload.put("bucket_name", document.getBucketName());
        
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("language", document.getLanguage());
        metadata.put("uploaded_by", triggeredBy.toString());
        payload.put("metadata", metadata);

        // Update document status to PARSING
        document.setStatus(ProcessingStatus.PARSING);
        document.setUpdatedAt(OffsetDateTime.now());
        documentRepository.save(document);

        // Publish to RabbitMQ
        eventPublisher.publishIngestionRequested(payload);
        
        log.info("Ingestion triggered: documentId={}, versionId={}, jobId={}", documentId, latestVersionId, jobId);
    }
}
