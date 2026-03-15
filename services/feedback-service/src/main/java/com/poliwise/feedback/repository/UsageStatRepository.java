package com.poliwise.feedback.repository;

import com.poliwise.feedback.entity.UsageStat;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface UsageStatRepository
                extends JpaRepository<UsageStat, UUID>, JpaSpecificationExecutor<UsageStat> {

        Page<UsageStat> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

        Page<UsageStat> findByServiceNameAndCreatedAtBetweenOrderByCreatedAtDesc(String serviceName,
                        OffsetDateTime from, OffsetDateTime to, Pageable pageable);

        long countByIsErrorTrueAndCreatedAtAfter(OffsetDateTime since);
}
