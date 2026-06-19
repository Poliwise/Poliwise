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
    public static final String USER_EXCHANGE_NAME = "poliwise.user.exchange";
    public static final String AUTH_EXCHANGE_NAME = "poliwise.auth.exchange";
    public static final String QUEUE_UNANSWERED = "poliwise.feedback.unanswered";
    public static final String QUEUE_DOCUMENT = "poliwise.feedback.document";
    public static final String QUEUE_USER = "poliwise.feedback.user";
    public static final String QUEUE_USER_PROFILE = "poliwise.feedback.user.profile";
    public static final String QUEUE_AUTH_LOGIN = "poliwise.feedback.auth.login";
    public static final String ROUTING_UNANSWERED = "unanswered.question";
    public static final String ROUTING_DOCUMENT_UPLOADED = "document.uploaded";
    public static final String ROUTING_DOCUMENT_DELETED = "document.deleted";
    public static final String ROUTING_USER_STATUS = "user.status.changed";
    public static final String ROUTING_USER_PROFILE = "user.profile.updated";
    public static final String ROUTING_AUTH_LOGIN = "user.login.*";

    @Bean public TopicExchange poliwiseExchange() { return new TopicExchange(EXCHANGE_NAME); }
    @Bean public TopicExchange userExchange() { return new TopicExchange(USER_EXCHANGE_NAME, true, false); }
    @Bean public TopicExchange authExchange() { return new TopicExchange(AUTH_EXCHANGE_NAME, true, false); }

    @Bean public Queue unansweredQueue() {
        return QueueBuilder.durable(QUEUE_UNANSWERED).withArgument("x-dead-letter-exchange", EXCHANGE_NAME + ".dlx").build();
    }
    @Bean public Queue documentQueue() {
        return QueueBuilder.durable(QUEUE_DOCUMENT).withArgument("x-dead-letter-exchange", EXCHANGE_NAME + ".dlx").build();
    }
    @Bean public Queue userQueue() {
        return QueueBuilder.durable(QUEUE_USER).withArgument("x-dead-letter-exchange", EXCHANGE_NAME + ".dlx").build();
    }
    @Bean public Queue userProfileQueue() {
        return QueueBuilder.durable(QUEUE_USER_PROFILE).withArgument("x-dead-letter-exchange", EXCHANGE_NAME + ".dlx").build();
    }
    @Bean public Queue authLoginQueue() {
        return QueueBuilder.durable(QUEUE_AUTH_LOGIN).withArgument("x-dead-letter-exchange", EXCHANGE_NAME + ".dlx").build();
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
    @Bean public Binding userStatusBindingFromEvents(Queue userQueue, TopicExchange poliwiseExchange) {
        return BindingBuilder.bind(userQueue).to(poliwiseExchange).with(ROUTING_USER_STATUS);
    }
    @Bean public Binding userStatusBindingFromUserExchange(Queue userQueue, TopicExchange userExchange) {
        return BindingBuilder.bind(userQueue).to(userExchange).with(ROUTING_USER_STATUS);
    }
    @Bean public Binding userProfileBinding(Queue userProfileQueue, TopicExchange userExchange) {
        return BindingBuilder.bind(userProfileQueue).to(userExchange).with(ROUTING_USER_PROFILE);
    }
    @Bean public Binding authLoginBinding(Queue authLoginQueue, TopicExchange authExchange) {
        return BindingBuilder.bind(authLoginQueue).to(authExchange).with(ROUTING_AUTH_LOGIN);
    }

    @Bean public MessageConverter jsonMessageConverter() { return new Jackson2JsonMessageConverter(); }
    @Bean public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate t = new RabbitTemplate(connectionFactory);
        t.setMessageConverter(jsonMessageConverter());
        return t;
    }
}
