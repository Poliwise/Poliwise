package com.poliwise.feedback.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE_NAME = "poliwise.events";
    public static final String QUEUE_UNANSWERED = "poliwise.feedback.unanswered";
    public static final String QUEUE_DOCUMENT = "poliwise.feedback.document";
    public static final String QUEUE_USER = "poliwise.feedback.user";
    public static final String ROUTING_UNANSWERED = "unanswered.question";
    public static final String ROUTING_DOCUMENT_UPLOADED = "document.uploaded";
    public static final String ROUTING_DOCUMENT_DELETED = "document.deleted";
    public static final String ROUTING_USER_STATUS = "user.status.changed";

    @Bean public TopicExchange poliwiseExchange() { return new TopicExchange(EXCHANGE_NAME); }

    @Bean public Queue unansweredQueue() {
        return QueueBuilder.durable(QUEUE_UNANSWERED).withArgument("x-dead-letter-exchange", EXCHANGE_NAME + ".dlx").build();
    }
    @Bean public Queue documentQueue() {
        return QueueBuilder.durable(QUEUE_DOCUMENT).withArgument("x-dead-letter-exchange", EXCHANGE_NAME + ".dlx").build();
    }
    @Bean public Queue userQueue() {
        return QueueBuilder.durable(QUEUE_USER).withArgument("x-dead-letter-exchange", EXCHANGE_NAME + ".dlx").build();
    }

    @Bean public Binding unansweredBinding(Queue unansweredQueue, TopicExchange poliwiseExchange) {
        return BindingBuilder.bind(unansweredQueue).to(poliwiseExchange).with(ROUTING_UNANSWERED);
    }
    @Bean public Binding documentUploadedBinding(Queue documentQueue, TopicExchange poliwiseExchange) {
        return BindingBuilder.bind(documentQueue).to(poliwiseExchange).with(ROUTING_DOCUMENT_UPLOADED);
    }
    @Bean public Binding documentDeletedBinding(Queue documentQueue, TopicExchange poliwiseExchange) {
        return BindingBuilder.bind(documentQueue).to(poliwiseExchange).with(ROUTING_DOCUMENT_DELETED);
    }
    @Bean public Binding userStatusBinding(Queue userQueue, TopicExchange poliwiseExchange) {
        return BindingBuilder.bind(userQueue).to(poliwiseExchange).with(ROUTING_USER_STATUS);
    }

    @Bean public MessageConverter jsonMessageConverter() { return new Jackson2JsonMessageConverter(); }
    @Bean public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate t = new RabbitTemplate(connectionFactory);
        t.setMessageConverter(jsonMessageConverter());
        return t;
    }
}
