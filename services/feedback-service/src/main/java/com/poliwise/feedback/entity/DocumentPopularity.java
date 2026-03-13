package com.poliwise.feedback.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "document_popularity", schema = "analytics")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentPopularity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "document_id")
    private UUID documentId;

    @Column(name = "total_citations")
    private Integer totalCitations;

    @Column(name = "unique_questions_cited")
    private Integer uniqueQuestionsCited;

    @Column(name = "citations_with_likes")
    private Integer citationsWithLikes;

    @Column(name = "citations_with_dislikes")
    private Integer citationsWithDislikes;

    @Column(name = "first_cited_at")
    private OffsetDateTime firstCitedAt;

    @Column(name = "last_cited_at")
    private OffsetDateTime lastCitedAt;

    @Column(name = "citations_last_7_days")
    private Integer citationsLast7Days;

    @Column(name = "citations_last_30_days")
    private Integer citationsLast30Days;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;


    /* ===== Helper methods ===== */

    public boolean isTrending() {
        return citationsLast7Days != null && citationsLast7Days > 10;
    }

    public double feedbackScore() {
        if (citationsWithLikes == null || citationsWithDislikes == null)
            return 0;

        int total = citationsWithLikes + citationsWithDislikes;
        if (total == 0)
            return 0;

        return (double) citationsWithLikes / total;
    }
}
