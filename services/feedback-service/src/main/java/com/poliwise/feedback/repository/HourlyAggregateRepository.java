package com.poliwise.feedback.repository;

import com.poliwise.feedback.entity.HourlyAggregate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface HourlyAggregateRepository extends JpaRepository<HourlyAggregate, UUID>,
                JpaSpecificationExecutor<HourlyAggregate> {

        Optional<HourlyAggregate> findByDatetime(OffsetDateTime datetime);

        List<HourlyAggregate> findByDatetimeBetweenOrderByDatetimeAsc(OffsetDateTime from,
                        OffsetDateTime to);
}
