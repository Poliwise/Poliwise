package com.poliwise.feedback.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "daily_aggregates", schema = "analytics")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DailyAggregate {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "date")
    private LocalDate date;

    @Column(name = "total_questions")
    private Integer totalQuestions;

    @Column(name = "total_conversations")
    private Integer totalConversations;

    @Column(name = "unique_users_asked")
    private Integer uniqueUsersAsked;

    @Column(name = "total_likes")
    private Integer totalLikes;

    @Column(name = "total_dislikes")
    private Integer totalDislikes;

    @Column(name = "feedback_ratio")
    private BigDecimal feedbackRatio;

    @Column(name = "avg_response_time_ms")
    private Integer avgResponseTimeMs;

    @Column(name = "p50_response_time_ms")
    private Integer p50ResponseTimeMs;

    @Column(name = "p95_response_time_ms")
    private Integer p95ResponseTimeMs;

    @Column(name = "p99_response_time_ms")
    private Integer p99ResponseTimeMs;

    @Column(name = "total_requests")
    private Integer totalRequests;

    @Column(name = "total_errors")
    private Integer totalErrors;

    @Column(name = "error_rate")
    private BigDecimal errorRate;

    @Column(name = "total_tokens_used")
    private Long totalTokensUsed;

    @Column(name = "avg_tokens_per_question")
    private Integer avgTokensPerQuestion;

    @Column(name = "avg_chunks_retrieved")
    private BigDecimal avgChunksRetrieved;

    @Column(name = "documents_uploaded")
    private Integer documentsUploaded;

    @Column(name = "documents_published")
    private Integer documentsPublished;

    @Column(name = "unique_active_users")
    private Integer uniqueActiveUsers;

    @Column(name = "new_users")
    private Integer newUsers;

    @Column(name = "unanswered_questions")
    private Integer unansweredQuestions;

    @Column(name = "resolved_questions")
    private Integer resolvedQuestions;

    @Column(name = "computed_at")
    private OffsetDateTime computedAt;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;


    /* ===== Helper methods cho dashboard ===== */

    public boolean hasErrors() {
        return totalErrors != null && totalErrors > 0;
    }

    public boolean hasLowFeedbackScore() {
        return feedbackRatio != null && feedbackRatio.doubleValue() < 0.5;
    }
}
