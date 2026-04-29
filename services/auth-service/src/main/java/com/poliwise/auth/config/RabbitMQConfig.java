package com.poliwise.auth.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String AUTH_EXCHANGE = "poliwise.auth.exchange";
    public static final String USER_REGISTERED_QUEUE = "poliwise.auth.user.registered";
    public static final String USER_STATUS_CHANGED_QUEUE = "poliwise.auth.user.status.changed";
    public static final String USER_ROUTING_KEY_REGISTERED = "user.registered";
    public static final String USER_ROUTING_KEY_STATUS = "user.status.changed";

    // Queue nhận events từ user-service
    public static final String USER_SERVICE_STATUS_QUEUE = "poliwise.user.status.received";

    @Bean
    public TopicExchange authExchange() {
        return new TopicExchange(AUTH_EXCHANGE, true, false);
    }

    @Bean
    public Queue userRegisteredQueue() {
        return QueueBuilder.durable(USER_REGISTERED_QUEUE).build();
    }

    @Bean
    public Queue userStatusChangedQueue() {
        return QueueBuilder.durable(USER_STATUS_CHANGED_QUEUE).build();
    }

    // Queue nhận status changed events từ user-service
    @Bean
    public Queue userServiceStatusQueue() {
        return QueueBuilder.durable(USER_SERVICE_STATUS_QUEUE).build();
    }

    @Bean
    public Binding userRegisteredBinding(Queue userRegisteredQueue, TopicExchange authExchange) {
        return BindingBuilder.bind(userRegisteredQueue)
                .to(authExchange)
                .with(USER_ROUTING_KEY_REGISTERED);
    }

    @Bean
    public Binding userStatusChangedBinding(Queue userStatusChangedQueue, TopicExchange authExchange) {
        return BindingBuilder.bind(userStatusChangedQueue)
                .to(authExchange)
                .with(USER_ROUTING_KEY_STATUS);
    }

    // Exchange của user-service để nhận events
    @Bean
    public TopicExchange userExchange() {
        return new TopicExchange("poliwise.user.exchange", true, false);
    }

    // Binding để nhận events từ user-service exchange
    @Bean
    public Binding userServiceStatusBinding(Queue userServiceStatusQueue, TopicExchange userExchange) {
        return BindingBuilder.bind(userServiceStatusQueue)
                .to(userExchange)
                .with("user.status.changed");
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
