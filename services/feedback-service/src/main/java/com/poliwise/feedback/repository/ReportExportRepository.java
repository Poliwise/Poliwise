package com.poliwise.feedback.repository;

import com.poliwise.feedback.entity.ReportExport;
import com.poliwise.feedback.enums.ReportType;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface ReportExportRepository
                extends JpaRepository<ReportExport, UUID>, JpaSpecificationExecutor<ReportExport> {

        List<ReportExport> findByRequestedByOrderByCreatedAtDesc(UUID requestedBy);

        List<ReportExport> findByReportTypeAndCreatedAtBetweenOrderByCreatedAtDesc(
                        ReportType reportType, OffsetDateTime from, OffsetDateTime to);

        List<ReportExport> findByStatusIgnoreCaseAndExpiresAtBefore(String status,
                        OffsetDateTime before);
}
