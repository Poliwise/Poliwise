package com.poliwise.feedback.repository;

import com.poliwise.feedback.entity.DailyAggregate;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface DailyAggregateRepository
        extends JpaRepository<DailyAggregate, UUID>, JpaSpecificationExecutor<DailyAggregate> {

    Optional<DailyAggregate> findByDate(LocalDate date);

    List<DailyAggregate> findByDateBetweenOrderByDateAsc(LocalDate from, LocalDate to);
}
