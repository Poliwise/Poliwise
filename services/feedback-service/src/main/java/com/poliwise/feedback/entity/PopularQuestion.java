package com.poliwise.feedback.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "popular_questions", schema = "analytics")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PopularQuestion {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "question_normalized", columnDefinition = "text")
    private String questionNormalized;

    @Column(name = "question_sample", columnDefinition = "text")
    private String questionSample;

    @Column(name = "ask_count")
    private Integer askCount;

    @Column(name = "unique_users_count")
    private Integer uniqueUsersCount;

    @Column(name = "first_asked_at")
    private OffsetDateTime firstAskedAt;

    @Column(name = "last_asked_at")
    private OffsetDateTime lastAskedAt;

    @Column(name = "total_likes")
    private Integer totalLikes;

    @Column(name = "total_dislikes")
    private Integer totalDislikes;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "common_source_documents", columnDefinition = "jsonb")
    private Map<String, Object> commonSourceDocuments;

    @Column(name = "detected_category")
    private String detectedCategory;

    @Column(name = "detected_department_id")
    private UUID detectedDepartmentId;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;


    /* ===== Helper methods ===== */

    public boolean isTrending() {
        return askCount != null && askCount > 20;
    }

    public double feedbackScore() {
        if (totalLikes == null || totalDislikes == null)
            return 0;

        int total = totalLikes + totalDislikes;
        if (total == 0)
            return 0;

        return (double) totalLikes / total;
    }
}
