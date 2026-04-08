package com.poliwise.feedback.consumer;

import com.poliwise.feedback.config.RabbitMQConfig;
import com.poliwise.feedback.entity.DocumentPopularity;
import com.poliwise.feedback.repository.DocumentPopularityRepository;
import com.poliwise.feedback.service.AuditLogService;
import com.poliwise.feedback.enums.AuditAction;
import com.poliwise.feedback.enums.ResourceType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Component
public class DocumentEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(DocumentEventConsumer.class);

    private final DocumentPopularityRepository documentPopularityRepository;
    private final AuditLogService auditLogService;

    public DocumentEventConsumer(DocumentPopularityRepository documentPopularityRepository,
                                AuditLogService auditLogService) {
        this.documentPopularityRepository = documentPopularityRepository;
        this.auditLogService = auditLogService;
    }

    @RabbitListener(queues = RabbitMQConfig.QUEUE_DOCUMENT)
    @Transactional
    public void handleDocumentEvent(Map<String, Object> message) {
        String routingKey = (String) message.get("routingKey");
        if (routingKey == null) routingKey = "";
        try {
            UUID documentId = parseUUID(message.get("documentId"));
            String documentName = (String) message.get("documentName");
            UUID uploadedBy = parseUUID(message.get("uploadedBy"));
            String userRole = (String) message.get("userRole");
            String ipAddress = (String) message.get("ipAddress");

            if (routingKey.contains("document.uploaded") || routingKey.equals(RabbitMQConfig.ROUTING_DOCUMENT_UPLOADED)) {
                handleDocumentUploaded(documentId, documentName, uploadedBy, userRole, ipAddress);
            } else if (routingKey.contains("document.deleted") || routingKey.equals(RabbitMQConfig.ROUTING_DOCUMENT_DELETED)) {
                handleDocumentDeleted(documentId, documentName, uploadedBy, userRole, ipAddress);
            }
        } catch (Exception e) {
            log.error("Failed to handle document event", e);
        }
    }

    private void handleDocumentUploaded(UUID documentId, String documentName, UUID uploadedBy, String userRole, String ipAddress) {
        Optional<DocumentPopularity> existing = documentPopularityRepository.findByDocumentId(documentId);
        if (existing.isEmpty()) {
            DocumentPopularity dp = DocumentPopularity.builder()
                    .documentId(documentId)
                    .totalCitations(0)
                    .uniqueQuestionsCited(0)
                    .build();
            documentPopularityRepository.save(dp);
        }
        auditLogService.logAction(uploadedBy, null, userRole,
                AuditAction.DOCUMENT_UPLOAD, ResourceType.DOCUMENT, documentId,
                documentName, ipAddress, null, null, "feedback-service", null);
        log.info("Document uploaded event processed: {}", documentId);
    }

    private void handleDocumentDeleted(UUID documentId, String documentName, UUID deletedBy, String userRole, String ipAddress) {
        auditLogService.logAction(deletedBy, null, userRole,
                AuditAction.DOCUMENT_DELETE, ResourceType.DOCUMENT, documentId,
                documentName, ipAddress, null, null, "feedback-service", null);
        log.info("Document deleted event processed: {}", documentId);
    }

    private UUID parseUUID(Object value) {
        if (value == null) return null;
        if (value instanceof UUID) return (UUID) value;
        try { return UUID.fromString(value.toString()); }
        catch (Exception e) { return null; }
    }
}
