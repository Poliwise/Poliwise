package com.poliwise.feedback.repository;

import com.poliwise.feedback.entity.Warning;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WarningRepository extends JpaRepository<Warning, UUID> {

    Page<Warning> findByUserIdAndReadAtIsNull(UUID userId, Pageable pageable);

    List<Warning> findByUserIdAndReadAtIsNullAndExpiresAtAfter(UUID userId, Instant now);

    Optional<Warning> findById(UUID id);

    @Query("SELECT COUNT(w) FROM Warning w WHERE w.userId = :userId AND w.readAt IS NULL")
    long countUnreadByUserId(@Param("userId") UUID userId);

    @Query("SELECT w FROM Warning w WHERE w.userId = :userId AND w.readAt IS NULL AND w.expiresAt > :now")
    List<Warning> findActiveWarnings(@Param("userId") UUID userId, @Param("now") Instant now);
}
