package com.poliwise.user.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String USER_EXCHANGE = "poliwise.user.exchange";
    public static final String USER_STATUS_CHANGED_QUEUE = "poliwise.user.status.changed";
    public static final String USER_REVOKED_QUEUE = "poliwise.user.revoked";
    public static final String USER_ROUTING_KEY_STATUS = "user.status.changed";
    public static final String USER_ROUTING_KEY_REVOKED = "user.revoked";

    @Bean
    public TopicExchange userExchange() {
        return new TopicExchange(USER_EXCHANGE, true, false);
    }

    @Bean
    public Queue userStatusChangedQueue() {
        return QueueBuilder.durable(USER_STATUS_CHANGED_QUEUE).build();
    }

    @Bean
    public Queue userRevokedQueue() {
        return QueueBuilder.durable(USER_REVOKED_QUEUE).build();
    }

    @Bean
    public Binding statusChangedBinding(Queue userStatusChangedQueue, TopicExchange userExchange) {
        return BindingBuilder.bind(userStatusChangedQueue)
                .to(userExchange)
                .with(USER_ROUTING_KEY_STATUS);
    }

    @Bean
    public Binding revokedBinding(Queue userRevokedQueue, TopicExchange userExchange) {
        return BindingBuilder.bind(userRevokedQueue)
                .to(userExchange)
                .with(USER_ROUTING_KEY_REVOKED);
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory, MessageConverter jsonMessageConverter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jsonMessageConverter);
        return template;
    }
}
