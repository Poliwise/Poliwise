package com.poliwise.feedback.repository;

import com.poliwise.feedback.entity.DepartmentDailyStat;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface DepartmentDailyStatRepository extends JpaRepository<DepartmentDailyStat, UUID>,
                JpaSpecificationExecutor<DepartmentDailyStat> {

        Optional<DepartmentDailyStat> findByDateAndDepartmentId(LocalDate date, UUID departmentId);

        List<DepartmentDailyStat> findByDepartmentIdAndDateBetweenOrderByDateAsc(UUID departmentId,
                        LocalDate from, LocalDate to);
}
