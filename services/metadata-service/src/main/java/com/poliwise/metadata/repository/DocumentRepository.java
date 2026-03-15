package com.poliwise.metadata.repository;

import com.poliwise.metadata.entity.Document;
import com.poliwise.metadata.enums.ProcessingStatus;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface DocumentRepository
                extends JpaRepository<Document, UUID>, JpaSpecificationExecutor<Document> {

        Optional<Document> findByFileKey(String fileKey);

        @Query("""
                        select d
                        from Document d
                        where d.deletedAt is null
                          and d.status in :statuses
                        order by d.updatedAt desc
                        """)
        Page<Document> findActiveByStatuses(
                        @Param("statuses") Collection<ProcessingStatus> statuses,
                        Pageable pageable);

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("select d from Document d where d.id = :id")
        Optional<Document> findByIdForUpdate(@Param("id") UUID id);
}
