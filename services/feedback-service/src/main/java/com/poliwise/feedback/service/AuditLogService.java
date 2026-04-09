package com.poliwise.feedback.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.poliwise.feedback.dto.request.AuditLogSearchRequest;
import com.poliwise.feedback.dto.response.AuditLogResponse;
import com.poliwise.feedback.entity.AuditLog;
import com.poliwise.feedback.enums.AuditAction;
import com.poliwise.feedback.enums.ResourceType;
import com.poliwise.feedback.repository.AuditLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
public class AuditLogService {

    private static final Logger log = LoggerFactory.getLogger(AuditLogService.class);
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    @Value("${poliwise.cleanup.audit-retention-days:90}")
    private int auditRetentionDays;

    public AuditLogService(AuditLogRepository auditLogRepository, ObjectMapper objectMapper) {
        this.auditLogRepository = auditLogRepository;
        this.objectMapper = objectMapper;
    }

    public void logAction(UUID userId, String username, String userRole,
                          AuditAction action, ResourceType resourceType, UUID resourceId,
                          String resourceName, String ipAddress, String userAgent,
                          String traceId, String serviceName, Map<String, Object> metadata) {
        try {
            AuditLog auditLog = AuditLog.builder()
                    .userId(userId).username(username).userRole(userRole)
                    .action(action).resourceType(resourceType).resourceId(resourceId)
                    .resourceName(resourceName).ipAddress(ipAddress).userAgent(userAgent)
                    .traceId(traceId).serviceName(serviceName)
                    .metadata(metadata != null ? objectMapper.writeValueAsString(metadata) : null)
                    .build();
            auditLogRepository.save(auditLog);
        } catch (Exception e) {
            log.error("Failed to log audit action: {}", action, e);
        }
    }

    @Transactional(readOnly = true)
    public Page<AuditLogResponse> searchLogs(AuditLogSearchRequest request, Pageable pageable) {
        Page<AuditLog> logs;
        if (request.action() != null) {
            logs = auditLogRepository.findByAction(request.action(), pageable);
        } else if (request.userId() != null) {
            logs = auditLogRepository.findByUserId(request.userId(), pageable);
        } else if (request.fromDate() != null && request.toDate() != null) {
            Instant from = request.fromDate().toInstant(ZoneOffset.UTC);
            Instant to = request.toDate().toInstant(ZoneOffset.UTC);
            logs = auditLogRepository.findByCreatedAtBetween(from, to, pageable);
        } else {
            logs = auditLogRepository.findAll(pageable);
        }
        return logs.map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public AuditLogResponse getAuditLogById(UUID id) {
        return auditLogRepository.findById(id).map(this::toResponse).orElse(null);
    }

    public long cleanupOldLogs() {
        Instant cutoff = Instant.now().minusSeconds((long) auditRetentionDays * 24 * 60 * 60);
        long count = auditLogRepository.countByCreatedAtBefore(cutoff);
        auditLogRepository.deleteByCreatedAtBefore(cutoff);
        log.info("Cleaned up {} old audit logs older than {} days", count, auditRetentionDays);
        return count;
    }

    private AuditLogResponse toResponse(AuditLog log) {
        return new AuditLogResponse(log.getId(), log.getUserId(), log.getUsername(),
                log.getUserRole(), log.getAction(), log.getResourceType(),
                log.getResourceId(), log.getResourceName(), log.getIpAddress(), log.getCreatedAt());
    }
}
