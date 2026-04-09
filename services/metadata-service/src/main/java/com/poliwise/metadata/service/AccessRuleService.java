package com.poliwise.metadata.service;

import com.poliwise.metadata.dto.CreateAccessRuleRequest;
import com.poliwise.metadata.dto.AccessRuleResponse;
import com.poliwise.metadata.entity.DocumentAccessRule;
import com.poliwise.metadata.enums.UserRole;
import com.poliwise.metadata.exception.ResourceNotFoundException;
import com.poliwise.metadata.repository.DocumentAccessRuleRepository;
import com.poliwise.metadata.repository.DocumentMetadataRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AccessRuleService {

    private static final Logger log = LoggerFactory.getLogger(AccessRuleService.class);

    private final DocumentAccessRuleRepository accessRuleRepository;
    private final DocumentMetadataRepository metadataRepository;

    public AccessRuleService(
            DocumentAccessRuleRepository accessRuleRepository,
            DocumentMetadataRepository metadataRepository) {
        this.accessRuleRepository = accessRuleRepository;
        this.metadataRepository = metadataRepository;
    }

    @Transactional
    public AccessRuleResponse create(UUID metadataId, CreateAccessRuleRequest request, UUID createdBy) {
        if (!metadataRepository.existsById(metadataId)) {
            throw new ResourceNotFoundException("Document metadata not found: " + metadataId);
        }

        OffsetDateTime now = OffsetDateTime.now();
        DocumentAccessRule rule = DocumentAccessRule.builder()
                .id(UUID.randomUUID())
                .documentMetadataId(metadataId)
                .targetType(request.targetType())
                .targetRole(request.targetRole() != null
                        ? UserRole.valueOf(request.targetRole())
                        : null)
                .targetDepartmentId(request.targetDepartmentId())
                .targetUserId(request.targetUserId())
                .permission(request.permission())
                .createdBy(createdBy)
                .createdAt(now)
                .build();

        DocumentAccessRule saved = accessRuleRepository.save(rule);
        log.info("Created access rule: id={}, metadataId={}", saved.getId(), metadataId);
        return toResponse(saved);
    }

    public List<AccessRuleResponse> getByMetadataId(UUID metadataId) {
        return accessRuleRepository.findByDocumentMetadataId(metadataId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public void delete(UUID id) {
        if (!accessRuleRepository.existsById(id)) {
            throw new ResourceNotFoundException("Access rule not found: " + id);
        }
        accessRuleRepository.deleteById(id);
        log.info("Deleted access rule: id={}", id);
    }

    public boolean hasAccess(UUID metadataId, UUID userId, UserRole role, UUID departmentId) {
        // Check if document exists and is published
        var metadata = metadataRepository.findById(metadataId).orElse(null);
        if (metadata == null) return false;

        // Check access rules for this document
        var rules = accessRuleRepository.findByDocumentMetadataId(metadataId);

        for (var rule : rules) {
            // Check user-specific access
            if (rule.getTargetUserId() != null && rule.getTargetUserId().equals(userId)) {
                return true;
            }

            // Check department access
            if (rule.getTargetDepartmentId() != null && rule.getTargetDepartmentId().equals(departmentId)) {
                return true;
            }

            // Check role access
            if (rule.getTargetRole() != null && rule.getTargetRole().equals(role)) {
                return true;
            }
        }

        return false;
    }

    private AccessRuleResponse toResponse(DocumentAccessRule rule) {
        return new AccessRuleResponse(
                rule.getId(),
                rule.getDocumentMetadataId(),
                rule.getTargetType(),
                rule.getTargetRole() != null ? rule.getTargetRole().name() : null,
                rule.getTargetDepartmentId(),
                rule.getTargetUserId(),
                rule.getPermission(),
                rule.getCreatedBy(),
                rule.getCreatedAt()
        );
    }
}