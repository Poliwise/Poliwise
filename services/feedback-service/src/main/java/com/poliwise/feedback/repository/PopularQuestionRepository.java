package com.poliwise.feedback.repository;

import com.poliwise.feedback.entity.PopularQuestion;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface PopularQuestionRepository extends JpaRepository<PopularQuestion, UUID>,
                JpaSpecificationExecutor<PopularQuestion> {

        Optional<PopularQuestion> findByQuestionNormalized(String questionNormalized);

        Page<PopularQuestion> findByDetectedDepartmentIdOrderByAskCountDesc(UUID departmentId,
                        Pageable pageable);

        List<PopularQuestion> findTop20ByOrderByAskCountDesc();
}
