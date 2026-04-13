package com.poliwise.knowledge.controller;

import com.poliwise.knowledge.dto.*;
import com.poliwise.knowledge.entity.Document;
import com.poliwise.knowledge.entity.DocumentVersion;
import com.poliwise.knowledge.security.SecurityUtils;
import com.poliwise.knowledge.security.UserRole;
import com.poliwise.knowledge.service.DocumentService;
import com.poliwise.knowledge.service.MetadataContextService;
import com.poliwise.knowledge.service.MetadataSuggestionService;
import com.poliwise.knowledge.service.PolicyComparisonService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/documents")
public class DocumentController {

    private final DocumentService documentService;
    private final PolicyComparisonService comparisonService;
    private final MetadataContextService metadataContextService;
    private final MetadataSuggestionService metadataSuggestionService;

    public DocumentController(
            DocumentService documentService,
            PolicyComparisonService comparisonService,
            MetadataContextService metadataContextService,
            MetadataSuggestionService metadataSuggestionService) {
        this.documentService = documentService;
        this.comparisonService = comparisonService;
        this.metadataContextService = metadataContextService;
        this.metadataSuggestionService = metadataSuggestionService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DocumentResponse> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "changelog", required = false, defaultValue = "") String changelog,
            @RequestParam(value = "language", required = false, defaultValue = "vi") String language) {

        UUID uploadedBy = SecurityUtils.getCurrentUserId();

        UploadDocumentRequest request = new UploadDocumentRequest(
                file.getOriginalFilename(),
                detectFileType(file.getOriginalFilename()),
                file.getSize(),
                file.getContentType(),
                null, null, null, null,
                language
        );

        Document document = documentService.upload(file, request, uploadedBy);
        DocumentResponse response = processAndSuggest(document, uploadedBy);

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    private DocumentResponse processAndSuggest(Document document, UUID uploadedBy) {
        // Phase 1: Fetch context and request metadata suggestion from ingestion-service
        MetadataSuggestionResponse suggestion = null;
        try {
            List<String> categorySlugs = metadataContextService.fetchActiveCategorySlugs();
            List<String> topTags = metadataContextService.fetchTopTagNames(20);

            MetadataSuggestionRequest suggestRequest = new MetadataSuggestionRequest(
                    document.getFileKey(),
                    document.getBucketName(),
                    categorySlugs,
                    topTags
            );

            suggestion = metadataSuggestionService.suggest(suggestRequest);
        } catch (Exception e) {
            // Fallback: metadata suggestion unavailable, user will enter manually
        }

        // Phase 2 processing disabled for Phase 1 manual testing
        // documentService.processDocument(document.getId(), uploadedBy);

        return toResponse(document, suggestion);
    }

    @GetMapping("/{documentId}")
    public ResponseEntity<DocumentResponse> get(@PathVariable UUID documentId) {
        return documentService.findById(documentId)
                .map(d -> toResponse(d, null))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{documentId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID documentId) {
        UUID deletedBy = SecurityUtils.getCurrentUserId();
        documentService.softDelete(documentId, deletedBy);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{documentId}/cancel")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> cancelUpload(@PathVariable UUID documentId) {
        documentService.cancelUpload(documentId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{documentId}/confirm")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DocumentResponse> confirm(
            @PathVariable UUID documentId,
            @Valid @RequestBody DocumentConfirmRequest request) {
        UUID confirmedBy = SecurityUtils.getCurrentUserId();
        com.poliwise.knowledge.entity.Document document =
                documentService.confirmMetadata(documentId, request, confirmedBy);
        return ResponseEntity.ok(toResponse(document));
    }

    @PostMapping("/{documentId}/process")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> process(@PathVariable UUID documentId) {
        UUID processedBy = SecurityUtils.getCurrentUserId();
        documentService.processDocument(documentId, processedBy);
        return ResponseEntity.accepted().build();
    }

    @GetMapping("/{documentId}/versions")
    public ResponseEntity<List<DocumentVersionResponse>> versions(@PathVariable UUID documentId) {
        List<DocumentVersionResponse> versions = documentService.getVersions(documentId)
                .stream()
                .map(this::toVersionResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(versions);
    }

    private DocumentResponse toResponse(Document d, MetadataSuggestionResponse suggestion) {
        String suggestedLanguage = (suggestion != null && suggestion.language() != null && !suggestion.language().isBlank())
                ? suggestion.language()
                : null;
        String categorySlug = suggestion != null ? suggestion.categorySlug() : null;
        String title = suggestion != null ? suggestion.title() : null;
        String description = suggestion != null ? suggestion.description() : null;
        List<String> tags = suggestion != null ? suggestion.tags() : List.of();
        Boolean isPolicy = suggestion != null ? suggestion.isPolicy() : null;

        return new DocumentResponse(
                d.getId(),
                d.getOriginalFilename(),
                d.getFileType(),
                d.getFileSizeBytes(),
                d.getMimeType(),
                d.getStatus(),
                d.getCurrentVersion(),
                d.getPageCount(),
                d.getWordCount(),
                d.getLanguage(),
                d.getOcrRequired(),
                d.getChunkingStrategy(),
                d.getChunkSize(),
                d.getChunkOverlap(),
                d.getEmbeddingModel(),
                d.getUploadedBy(),
                d.getCreatedAt(),
                d.getUpdatedAt(),
                suggestedLanguage,
                categorySlug,
                title,
                description,
                tags,
                isPolicy
        );
    }

    private DocumentResponse toResponse(Document d) {
        return toResponse(d, null);
    }

    private DocumentVersionResponse toVersionResponse(DocumentVersion v) {
        return new DocumentVersionResponse(
                v.getId(),
                v.getDocumentId(),
                v.getVersionNumber(),
                v.getFileKey(),
                v.getFileSizeBytes(),
                v.getChangelog(),
                v.getCreatedBy(),
                v.getCreatedAt()
        );
    }

    private com.poliwise.knowledge.enums.FileType detectFileType(String filename) {
        if (filename == null) return com.poliwise.knowledge.enums.FileType.PDF;
        String lower = filename.toLowerCase();
        if (lower.endsWith(".pdf")) return com.poliwise.knowledge.enums.FileType.PDF;
        if (lower.endsWith(".docx")) return com.poliwise.knowledge.enums.FileType.DOCX;
        if (lower.endsWith(".xlsx")) return com.poliwise.knowledge.enums.FileType.XLSX;
        if (lower.endsWith(".doc")) return com.poliwise.knowledge.enums.FileType.DOC;
        if (lower.endsWith(".xls")) return com.poliwise.knowledge.enums.FileType.XLS;
        if (lower.endsWith(".txt")) return com.poliwise.knowledge.enums.FileType.TXT;
        if (lower.endsWith(".png")) return com.poliwise.knowledge.enums.FileType.PNG;
        if (lower.endsWith(".jpg")) return com.poliwise.knowledge.enums.FileType.JPG;
        if (lower.endsWith(".jpeg")) return com.poliwise.knowledge.enums.FileType.JPEG;
        return com.poliwise.knowledge.enums.FileType.PDF;
    }
}