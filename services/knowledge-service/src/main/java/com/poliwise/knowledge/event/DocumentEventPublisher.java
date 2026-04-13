package com.poliwise.knowledge.event;

import com.poliwise.knowledge.config.RabbitMQConfig;
import com.poliwise.knowledge.dto.event.DocumentDeletedEvent;
import com.poliwise.knowledge.dto.event.DocumentUploadedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import java.util.Map;

@Component
public class DocumentEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(DocumentEventPublisher.class);

    private final RabbitTemplate rabbitTemplate;

    public DocumentEventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publishDocumentUploaded(DocumentUploadedEvent event) {
        try {
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.KNOWLEDGE_EXCHANGE,
                    RabbitMQConfig.DOCUMENT_ROUTING_KEY_UPLOADED,
                    Map.of("payload", event)
            );
            log.info("Published DocumentUploadedEvent: documentId={}, fileName={}",
                    event.documentId(), event.fileName());
        } catch (Exception e) {
            log.error("Failed to publish DocumentUploadedEvent: {}", e.getMessage(), e);
        }
    }

    public void publishDocumentDeleted(DocumentDeletedEvent event) {
        try {
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.KNOWLEDGE_EXCHANGE,
                    RabbitMQConfig.DOCUMENT_ROUTING_KEY_DELETED,
                    Map.of("payload", event)
            );
            log.info("Published DocumentDeletedEvent: documentId={}", event.documentId());
        } catch (Exception e) {
            log.error("Failed to publish DocumentDeletedEvent: {}", e.getMessage(), e);
        }
    }
}