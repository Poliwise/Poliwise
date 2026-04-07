package com.poliwise.knowledge.controller;

import com.poliwise.knowledge.dto.*;
import com.poliwise.knowledge.entity.Document;
import com.poliwise.knowledge.entity.DocumentVersion;
import com.poliwise.knowledge.security.SecurityUtils;
import com.poliwise.knowledge.security.UserRole;
import com.poliwise.knowledge.service.DocumentService;
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

    public DocumentController(DocumentService documentService, PolicyComparisonService comparisonService) {
        this.documentService = documentService;
        this.comparisonService = comparisonService;
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

        // Start processing asynchronously
        try {
            documentService.processDocument(document.getId(), uploadedBy);
        } catch (Exception e) {
            // Processing will be retried or done async
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(document));
    }

    @GetMapping("/{documentId}")
    public ResponseEntity<DocumentResponse> get(@PathVariable UUID documentId) {
        return documentService.findById(documentId)
                .map(this::toResponse)
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

    private DocumentResponse toResponse(Document d) {
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
                d.getUpdatedAt()
        );
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