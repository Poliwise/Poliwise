package com.poliwise.feedback.repository;

import com.poliwise.feedback.entity.Violation;
import com.poliwise.feedback.enums.AppealStatus;
import com.poliwise.feedback.enums.ViolationStatus;
import com.poliwise.feedback.enums.ViolationAction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ViolationRepository extends JpaRepository<Violation, UUID> {

    Page<Violation> findByUserIdAndDeletedAtIsNull(UUID userId, Pageable pageable);

    Page<Violation> findByStatusAndDeletedAtIsNull(ViolationStatus status, Pageable pageable);

    Page<Violation> findByAppealStatusAndDeletedAtIsNull(AppealStatus appealStatus, Pageable pageable);

    Page<Violation> findByActionTakenAndDeletedAtIsNull(ViolationAction actionTaken, Pageable pageable);

    Optional<Violation> findByIdAndDeletedAtIsNull(UUID id);

    @Query("SELECT COUNT(v) FROM Violation v WHERE v.userId = :userId AND v.deletedAt IS NULL")
    long countByUserId(@Param("userId") UUID userId);

    @Query("SELECT COUNT(v) FROM Violation v WHERE v.status = :status AND v.deletedAt IS NULL")
    long countByStatus(@Param("status") ViolationStatus status);

    @Query("SELECT COUNT(v) FROM Violation v WHERE v.deletedAt IS NULL")
    long countTotalViolations();

    @Query("SELECT DISTINCT v.userId FROM Violation v WHERE v.status = :status AND v.deletedAt IS NULL")
    Page<UUID> findDistinctUserIdsWithStatus(@Param("status") ViolationStatus status, Pageable pageable);

    @Query("SELECT COUNT(DISTINCT v.userId) FROM Violation v WHERE v.status = :status AND v.deletedAt IS NULL")
    long countDistinctUsersWithStatus(@Param("status") ViolationStatus status);
}

