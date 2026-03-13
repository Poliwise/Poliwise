package com.poliwise.feedback.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "unanswered_questions", schema = "conversation")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UnansweredQuestion {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "message_id")
    private UUID messageId;

    @Column(name = "conversation_id")
    private UUID conversationId;

    @Column(name = "question", columnDefinition = "text")
    private String question;

    @Column(name = "question_normalized", columnDefinition = "text")
    private String questionNormalized;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "attempted_context", columnDefinition = "jsonb")
    private Map<String, Object> attemptedContext;

    @Column(name = "search_query", columnDefinition = "text")
    private String searchQuery;

    @Column(name = "top_similarity_score")
    private BigDecimal topSimilarityScore;

    @Column(name = "user_department_id")
    private UUID userDepartmentId;

    @Column(name = "user_role")
    private String userRole;

    @Column(name = "resolved")
    private Boolean resolved;

    @Column(name = "resolved_by")
    private UUID resolvedBy;

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    @Column(name = "resolution_notes", columnDefinition = "text")
    private String resolutionNotes;

    @Column(name = "related_document_id")
    private UUID relatedDocumentId;

    @Column(name = "category")
    private String category;

    @Column(name = "priority")
    private String priority;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;


    /* ===== Helper methods ===== */

    public boolean isResolved() {
        return Boolean.TRUE.equals(resolved);
    }

    public boolean isHighPriority() {
        return "HIGH".equalsIgnoreCase(priority);
    }

    public boolean hasLowSimilarity() {
        return topSimilarityScore != null && topSimilarityScore.doubleValue() < 0.3;
    }
}
