package com.poliwise.metadata.service;

import com.poliwise.metadata.dto.CreateAccessRuleRequest;
import com.poliwise.metadata.dto.AccessRuleResponse;
import com.poliwise.metadata.entity.DocumentAccessRule;
import com.poliwise.metadata.entity.DocumentMetadata;
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

        // Validate that at least one target is specified
        if (request.targetType() == null || request.targetType().isBlank()) {
            throw new IllegalArgumentException("Target type is required (ROLE, DEPARTMENT, USER)");
        }

        switch (request.targetType().toUpperCase()) {
            case "ROLE" -> {
                if (request.targetRole() == null) {
                    throw new IllegalArgumentException("Role must be specified for ROLE target type");
                }
            }
            case "DEPARTMENT" -> {
                if (request.targetDepartmentId() == null) {
                    throw new IllegalArgumentException("Department ID must be specified for DEPARTMENT target type");
                }
            }
            case "USER" -> {
                if (request.targetUserId() == null) {
                    throw new IllegalArgumentException("User ID must be specified for USER target type");
                }
            }
            default -> throw new IllegalArgumentException("Invalid target type: " + request.targetType() + ". Must be ROLE, DEPARTMENT, or USER");
        }

        OffsetDateTime now = OffsetDateTime.now();
        DocumentAccessRule rule = DocumentAccessRule.builder()
                .id(UUID.randomUUID())
                .documentMetadataId(metadataId)
                .targetType(request.targetType().toUpperCase())
                .targetRole(request.targetRole() != null ? UserRole.valueOf(request.targetRole().toUpperCase()) : null)
                .targetDepartmentId(request.targetDepartmentId())
                .targetUserId(request.targetUserId())
                .permission(request.permission() != null ? request.permission().toUpperCase() : "VIEW")
                .createdBy(createdBy)
                .createdAt(now)
                .build();

        DocumentAccessRule saved = accessRuleRepository.save(rule);
        log.info("Created access rule: id={}, metadataId={}, targetType={}", saved.getId(), metadataId, saved.getTargetType());
        return toResponse(saved);
    }

    public List<AccessRuleResponse> getByMetadataId(UUID metadataId) {
        return accessRuleRepository.findByDocumentMetadataId(metadataId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public List<AccessRuleResponse> getAll() {
        return accessRuleRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public void delete(UUID id) {
        if (!accessRuleRepository.existsById(id)) {
            throw new ResourceNotFoundException("Access rule not found: " + id);
        }
        accessRuleRepository.deleteById(id);
        log.info("Deleted access rule: id={}", id);
    }

    @Transactional
    public void deleteByMetadataId(UUID metadataId) {
        List<DocumentAccessRule> rules = accessRuleRepository.findByDocumentMetadataId(metadataId);
        accessRuleRepository.deleteAll(rules);
        log.info("Deleted {} access rules for metadata: {}", rules.size(), metadataId);
    }

    /**
     * Check if user has access to a document at runtime.
     * This method enforces ACL rules when users try to access documents.
     * 
     * Access check priority:
     * 1. ADMIN always has access
     * 2. DENY rules take precedence over VIEW rules
     * 3. Specific rules (USER > DEPARTMENT > ROLE) take precedence over general rules
     * 
     * @param metadataId Document metadata ID
     * @param userId User's UUID
     * @param role User's role
     * @param departmentId User's department UUID
     * @return true if user has access, false otherwise
     */
    public boolean hasAccess(UUID metadataId, UUID userId, UserRole role, UUID departmentId) {
        // 1. ADMIN always has access
        if (role == UserRole.ADMIN) {
            log.debug("Admin always has access: metadataId={}", metadataId);
            return true;
        }

        // 2. Check if document exists and is published
        DocumentMetadata metadata = metadataRepository.findById(metadataId).orElse(null);
        if (metadata == null) {
            log.warn("Document metadata not found: {}", metadataId);
            return false;
        }

        // 3. PUBLIC documents are accessible to all authenticated users
        if (metadata.getAccessLevel() != null && 
            metadata.getAccessLevel().name().equals("PUBLIC")) {
            log.debug("Public document: metadataId={}", metadataId);
            return true;
        }

        // 4. Get access rules for this document
        List<DocumentAccessRule> rules = accessRuleRepository.findByDocumentMetadataId(metadataId);
        
        if (rules.isEmpty()) {
            // No rules = restricted (deny by default for non-public)
            log.debug("No access rules, denying: metadataId={}", metadataId);
            return false;
        }

        // 5. Check DENY rules first (DENY takes precedence)
        boolean hasExplicitDeny = checkDenyRules(rules, userId, role, departmentId);
        if (hasExplicitDeny) {
            log.debug("User explicitly denied: metadataId={}, userId={}", metadataId, userId);
            return false;
        }

        // 6. Check VIEW rules
        boolean hasViewAccess = checkViewRules(rules, userId, role, departmentId);
        if (hasViewAccess) {
            log.debug("User granted view access: metadataId={}, userId={}", metadataId, userId);
            return true;
        }

        // 7. Default deny
        log.debug("No matching rules, denying: metadataId={}, userId={}", metadataId, userId);
        return false;
    }

    private boolean checkDenyRules(List<DocumentAccessRule> rules, UUID userId, UserRole role, UUID departmentId) {
        for (DocumentAccessRule rule : rules) {
            if (!"DENY".equalsIgnoreCase(rule.getPermission())) {
                continue;
            }

            if (matchesRule(rule, userId, role, departmentId)) {
                return true;
            }
        }
        return false;
    }

    private boolean checkViewRules(List<DocumentAccessRule> rules, UUID userId, UserRole role, UUID departmentId) {
        for (DocumentAccessRule rule : rules) {
            if (!"VIEW".equalsIgnoreCase(rule.getPermission())) {
                continue;
            }

            if (matchesRule(rule, userId, role, departmentId)) {
                return true;
            }
        }
        return false;
    }

    private boolean matchesRule(DocumentAccessRule rule, UUID userId, UserRole role, UUID departmentId) {
        switch (rule.getTargetType().toUpperCase()) {
            case "USER" -> {
                return rule.getTargetUserId() != null && rule.getTargetUserId().equals(userId);
            }
            case "DEPARTMENT" -> {
                return rule.getTargetDepartmentId() != null && 
                       departmentId != null && 
                       rule.getTargetDepartmentId().equals(departmentId);
            }
            case "ROLE" -> {
                return rule.getTargetRole() != null && rule.getTargetRole().equals(role);
            }
            default -> {
                log.warn("Unknown target type in rule {}: {}", rule.getId(), rule.getTargetType());
                return false;
            }
        }
    }

    /**
     * Filter document IDs based on user's access rights.
     * Used for filtering document lists.
     */
    public List<UUID> filterAccessibleDocuments(List<UUID> metadataIds, UUID userId, UserRole role, UUID departmentId) {
        return metadataIds.stream()
                .filter(id -> hasAccess(id, userId, role, departmentId))
                .toList();
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
