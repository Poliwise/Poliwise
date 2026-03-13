package com.poliwise.feedback.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "department_daily_stats", schema = "analytics")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DepartmentDailyStat {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "date")
    private LocalDate date;

    @Column(name = "department_id")
    private UUID departmentId;

    @Column(name = "total_questions")
    private Integer totalQuestions;

    @Column(name = "unique_users")
    private Integer uniqueUsers;

    @Column(name = "likes")
    private Integer likes;

    @Column(name = "dislikes")
    private Integer dislikes;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "top_categories", columnDefinition = "jsonb")
    private Map<String, Object> topCategories;

    @Column(name = "computed_at")
    private OffsetDateTime computedAt;


    /* ===== Helper methods ===== */

    public boolean hasNegativeFeedback() {
        return dislikes != null && dislikes > likes;
    }

    public double feedbackScore() {
        if (likes == null || dislikes == null) {
            return 0;
        }
        int total = likes + dislikes;
        if (total == 0)
            return 0;
        return (double) likes / total;
    }
}
