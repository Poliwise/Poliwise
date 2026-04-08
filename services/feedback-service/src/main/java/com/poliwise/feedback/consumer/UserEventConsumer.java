package com.poliwise.feedback.consumer;

import com.poliwise.feedback.config.RabbitMQConfig;
import com.poliwise.feedback.service.AuditLogService;
import com.poliwise.feedback.enums.AuditAction;
import com.poliwise.feedback.enums.ResourceType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

@Component
public class UserEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(UserEventConsumer.class);

    private final AuditLogService auditLogService;

    public UserEventConsumer(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    @RabbitListener(queues = RabbitMQConfig.QUEUE_USER)
    public void handleUserEvent(Map<String, Object> message) {
        try {
            UUID userId = parseUUID(message.get("userId"));
            String username = (String) message.get("username");
            String oldStatus = (String) message.get("oldStatus");
            String newStatus = (String) message.get("newStatus");
            String ipAddress = (String) message.get("ipAddress");

            auditLogService.logAction(userId, username, null,
                    AuditAction.USER_UPDATE, ResourceType.USER, userId,
                    username, ipAddress, null, null, "feedback-service",
                    Map.of("oldStatus", oldStatus != null ? oldStatus : "",
                           "newStatus", newStatus != null ? newStatus : ""));

            log.info("User status changed event processed: {} {} -> {}", username, oldStatus, newStatus);
        } catch (Exception e) {
            log.error("Failed to handle user event", e);
        }
    }

    private UUID parseUUID(Object value) {
        if (value == null) return null;
        if (value instanceof UUID) return (UUID) value;
        try { return UUID.fromString(value.toString()); }
        catch (Exception e) { return null; }
    }
}
