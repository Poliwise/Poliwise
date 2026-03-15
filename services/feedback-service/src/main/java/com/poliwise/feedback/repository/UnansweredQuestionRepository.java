package com.poliwise.feedback.repository;

import com.poliwise.feedback.entity.UnansweredQuestion;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface UnansweredQuestionRepository extends JpaRepository<UnansweredQuestion, UUID>,
                JpaSpecificationExecutor<UnansweredQuestion> {

        Page<UnansweredQuestion> findByResolvedFalseOrderByCreatedAtDesc(Pageable pageable);

        Page<UnansweredQuestion> findByResolvedTrueAndResolvedAtBetweenOrderByResolvedAtDesc(
                        OffsetDateTime from, OffsetDateTime to, Pageable pageable);

        List<UnansweredQuestion> findByUserDepartmentIdAndResolvedFalseOrderByCreatedAtDesc(
                        UUID departmentId);
}
