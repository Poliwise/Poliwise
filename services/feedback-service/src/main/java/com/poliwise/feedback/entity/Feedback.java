package com.poliwise.feedback.entity;

import com.poliwise.feedback.enums.FeedbackType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "feedbacks", schema = "analytics")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Feedback {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "message_id")
    private UUID messageId;

    @Column(name = "conversation_id")
    private UUID conversationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", columnDefinition = "analytics.feedback_type")
    private FeedbackType type;

    @Column(name = "comment", columnDefinition = "text")
    private String comment;

    @Column(name = "question_text", columnDefinition = "text")
    private String questionText;

    @Column(name = "answer_text", columnDefinition = "text")
    private String answerText;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "sources_used", columnDefinition = "jsonb")
    private Map<String, Object> sourcesUsed;

    @Column(name = "user_department_id")
    private UUID userDepartmentId;

    @Column(name = "user_role")
    private String userRole;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;


    /* ===== Helper methods ===== */

    public boolean isPositive() {
        return type == FeedbackType.LIKE;
    }

    public boolean isNegative() {
        return type == FeedbackType.DISLIKE;
    }
}
