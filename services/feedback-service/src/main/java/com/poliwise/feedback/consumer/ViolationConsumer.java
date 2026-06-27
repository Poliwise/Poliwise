package com.poliwise.feedback.consumer;

import com.poliwise.feedback.config.RabbitMQConfig;
import com.poliwise.feedback.enums.ViolationSeverity;
import com.poliwise.feedback.enums.ViolationType;
import com.poliwise.feedback.service.ViolationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

@Component
public class ViolationConsumer {

    private static final Logger log = LoggerFactory.getLogger(ViolationConsumer.class);

    private final ViolationService violationService;

    public ViolationConsumer(ViolationService violationService) {
        this.violationService = violationService;
    }

    @RabbitListener(queues = RabbitMQConfig.QUEUE_VIOLATION)
    public void handleViolation(Map<String, Object> message) {
        try {
            Map<String, Object> payload = (Map<String, Object>) message.get("payload");
            if (payload == null) {
                log.error("Violation message missing 'payload' key: {}", message.keySet());
                return;
            }

            UUID userId = parseUUID(payload.get("user_id"));
            String violationTypeStr = (String) payload.get("violation_type");
            String severityStr = (String) payload.get("severity");
            String evidence = (String) payload.get("evidence");
            String source = (String) payload.get("source");
            String userRole = (String) payload.getOrDefault("user_role", "USER");
            UUID departmentId = parseUUID(payload.get("user_department_id"));

            ViolationType violationType;
            try {
                violationType = ViolationType.valueOf(violationTypeStr);
            } catch (Exception e) {
                violationType = ViolationType.TOXIC_QUERY;
            }

            ViolationSeverity severity;
            try {
                severity = ViolationSeverity.valueOf(severityStr);
            } catch (Exception e) {
                severity = ViolationSeverity.LOW;
            }

            violationService.logViolation(
                    userId,
                    violationType,
                    severity,
                    evidence,
                    source,
                    departmentId,
                    userRole
            );

            log.info("Processed violation for user {}: type={}, severity={}",
                    userId, violationType, severity);
        } catch (Exception e) {
            log.error("Failed to handle violation message", e);
        }
    }

    private UUID parseUUID(Object value) {
        if (value == null) return null;
        if (value instanceof UUID) return (UUID) value;
        try { return UUID.fromString(value.toString()); }
        catch (Exception e) { return null; }
    }
}
