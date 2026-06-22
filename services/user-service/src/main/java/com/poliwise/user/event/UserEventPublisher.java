package com.poliwise.user.event;

import com.poliwise.user.config.RabbitMQConfig;
import com.poliwise.user.dto.event.UserRevokedEvent;
import com.poliwise.user.dto.event.UserStatusChangedEvent;
import com.poliwise.user.dto.event.ProfileUpdatedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

@Component
public class UserEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(UserEventPublisher.class);

    private final RabbitTemplate rabbitTemplate;

    public UserEventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publishStatusChanged(UserStatusChangedEvent event) {
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.USER_EXCHANGE,
                RabbitMQConfig.USER_ROUTING_KEY_STATUS,
                event
        );
        log.info("Published UserStatusChangedEvent: userId={}, from={} to={}",
                event.userId(), event.previousStatus(), event.newStatus());
    }

    public void publishRevoked(UserRevokedEvent event) {
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.USER_EXCHANGE,
                RabbitMQConfig.USER_ROUTING_KEY_REVOKED,
                event
        );
        log.info("Published UserRevokedEvent: userId={}, revokedBy={}",
                event.userId(), event.revokedBy());
    }

    public void publishProfileUpdated(ProfileUpdatedEvent event) {
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.USER_EXCHANGE,
                RabbitMQConfig.USER_ROUTING_KEY_PROFILE,
                event
        );
        log.info("Published ProfileUpdatedEvent: userId={}, updatedBy={}",
                event.userId(), event.updatedBy());
    }
}
