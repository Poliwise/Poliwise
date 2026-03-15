package com.poliwise.knowledge.repository;

import com.poliwise.knowledge.entity.DocumentVersion;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface DocumentVersionRepository
        extends JpaRepository<DocumentVersion, UUID>, JpaSpecificationExecutor<DocumentVersion> {

    List<DocumentVersion> findByDocumentIdOrderByVersionNumberDesc(UUID documentId);

    Optional<DocumentVersion> findFirstByDocumentIdOrderByVersionNumberDesc(UUID documentId);

    boolean existsByDocumentIdAndVersionNumber(UUID documentId, Integer versionNumber);
}
