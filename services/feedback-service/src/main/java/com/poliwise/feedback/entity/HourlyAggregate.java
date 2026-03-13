package com.poliwise.feedback.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "hourly_aggregates", schema = "analytics")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HourlyAggregate {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "datetime")
    private OffsetDateTime datetime;

    @Column(name = "hour")
    private Integer hour;

    @Column(name = "total_questions")
    private Integer totalQuestions;

    @Column(name = "total_requests")
    private Integer totalRequests;

    @Column(name = "total_errors")
    private Integer totalErrors;

    @Column(name = "unique_users")
    private Integer uniqueUsers;

    @Column(name = "avg_response_time_ms")
    private Integer avgResponseTimeMs;

    @Column(name = "likes")
    private Integer likes;

    @Column(name = "dislikes")
    private Integer dislikes;

    @Column(name = "computed_at")
    private OffsetDateTime computedAt;


    /* ===== Helper methods ===== */

    public boolean hasErrors() {
        return totalErrors != null && totalErrors > 0;
    }

    public double errorRate() {
        if (totalRequests == null || totalRequests == 0) {
            return 0;
        }
        return (double) totalErrors / totalRequests;
    }

    public boolean hasNegativeFeedback() {
        return dislikes != null && dislikes > 0;
    }
}
