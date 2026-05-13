package com.poliwise.metadata.controller;

import com.poliwise.metadata.dto.*;
import com.poliwise.metadata.security.SecurityUtils;
import com.poliwise.metadata.service.DocumentMetadataService;
import com.poliwise.metadata.service.AccessRuleService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/metadata")
public class DocumentMetadataController {

    private final DocumentMetadataService metadataService;
    private final AccessRuleService accessRuleService;

    public DocumentMetadataController(
            DocumentMetadataService metadataService,
            AccessRuleService accessRuleService) {
        this.metadataService = metadataService;
        this.accessRuleService = accessRuleService;
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DocumentMetadataResponse> create(
            @Valid @RequestBody CreateDocumentMetadataRequest request) {
        UUID createdBy = SecurityUtils.getCurrentUserId();
        DocumentMetadataResponse response = metadataService.create(request, createdBy);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/document/{documentId}")
    public ResponseEntity<DocumentMetadataResponse> getByDocumentId(@PathVariable UUID documentId) {
        DocumentMetadataResponse response = metadataService.getByDocumentId(documentId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<List<DocumentMetadataResponse>> getByStatus(@PathVariable String status) {
        var docStatus = com.poliwise.metadata.enums.DocumentStatus.valueOf(status.toUpperCase());
        List<DocumentMetadataResponse> response = metadataService.findByStatus(docStatus);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/category/{categoryId}")
    public ResponseEntity<List<DocumentMetadataResponse>> getByCategory(@PathVariable UUID categoryId) {
        List<DocumentMetadataResponse> response = metadataService.findByCategory(categoryId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{metadataId}/rules")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AccessRuleResponse> addRule(
            @PathVariable UUID metadataId,
            @Valid @RequestBody CreateAccessRuleRequest request) {
        UUID createdBy = SecurityUtils.getCurrentUserId();
        AccessRuleResponse response = accessRuleService.create(metadataId, request, createdBy);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{metadataId}/rules")
    public ResponseEntity<List<AccessRuleResponse>> getRules(@PathVariable UUID metadataId) {
        List<AccessRuleResponse> rules = accessRuleService.getByMetadataId(metadataId);
        return ResponseEntity.ok(rules);
    }

    @DeleteMapping("/rules/{ruleId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteRule(@PathVariable UUID ruleId) {
        accessRuleService.delete(ruleId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<DocumentMetadataResponse> get(@PathVariable UUID id) {
        DocumentMetadataResponse response = metadataService.getById(id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DocumentMetadataResponse> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateDocumentMetadataRequest request) {
        UUID updatedBy = SecurityUtils.getCurrentUserId();
        DocumentMetadataResponse response = metadataService.update(id, request, updatedBy);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/publish")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DocumentMetadataResponse> publish(@PathVariable UUID id) {
        UUID publishedBy = SecurityUtils.getCurrentUserId();
        DocumentMetadataResponse response = metadataService.publish(id, publishedBy);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/archive")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DocumentMetadataResponse> archive(@PathVariable UUID id) {
        UUID archivedBy = SecurityUtils.getCurrentUserId();
        DocumentMetadataResponse response = metadataService.archive(id, archivedBy);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        metadataService.softDelete(id);
        return ResponseEntity.noContent().build();
    }
}