package com.poliwise.feedback.repository;

import com.poliwise.feedback.entity.DocumentPopularity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface DocumentPopularityRepository extends JpaRepository<DocumentPopularity, UUID>,
        JpaSpecificationExecutor<DocumentPopularity> {

    Optional<DocumentPopularity> findByDocumentId(UUID documentId);

    List<DocumentPopularity> findTop20ByOrderByCitationsLast7DaysDesc();
}
