package com.poliwise.feedback.repository;

import com.poliwise.feedback.entity.AuditLog;
import com.poliwise.feedback.enums.AuditAction;
import com.poliwise.feedback.enums.ResourceType;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface AuditLogRepository
                extends JpaRepository<AuditLog, UUID>, JpaSpecificationExecutor<AuditLog> {

        Page<AuditLog> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

        Page<AuditLog> findByActionAndCreatedAtBetweenOrderByCreatedAtDesc(AuditAction action,
                        OffsetDateTime from, OffsetDateTime to, Pageable pageable);

        Page<AuditLog> findByResourceTypeAndResourceIdOrderByCreatedAtDesc(
                        ResourceType resourceType, UUID resourceId, Pageable pageable);

        Page<AuditLog> findByTraceIdOrderByCreatedAtDesc(String traceId, Pageable pageable);
}
