package com.poliwise.knowledge.repository;

import com.poliwise.knowledge.entity.DocumentLock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DocumentLockRepository extends JpaRepository<DocumentLock, UUID> {

    Optional<DocumentLock> findByDocumentId(UUID documentId);

    void deleteByDocumentId(UUID documentId);

    @Modifying
    @Query("DELETE FROM DocumentLock l WHERE l.expiresAt < :now")
    int deleteExpiredLocks(@Param("now") OffsetDateTime now);
}
