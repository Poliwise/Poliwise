package com.poliwise.feedback.repository;

import com.poliwise.feedback.entity.Feedback;
import com.poliwise.feedback.enums.FeedbackType;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface FeedbackRepository
        extends JpaRepository<Feedback, UUID>, JpaSpecificationExecutor<Feedback> {

    Page<Feedback> findByTypeOrderByCreatedAtDesc(FeedbackType type, Pageable pageable);

    List<Feedback> findByConversationIdOrderByCreatedAtDesc(UUID conversationId);

    long countByTypeAndCreatedAtAfter(FeedbackType type, OffsetDateTime since);

    boolean existsByMessageIdAndUserId(UUID messageId, UUID userId);
}
