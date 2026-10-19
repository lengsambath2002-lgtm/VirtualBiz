package com.kosign.vbiz.promotion.repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kosign.vbiz.promotion.domain.Deal;

public interface DealRepository extends JpaRepository<Deal, UUID> {

    @Query("""
            select d from Deal d where d.startsAt <= :now and d.endsAt >= :now
            order by d.endsAt asc, d.id asc""")
    List<Deal> active(@Param("now") Instant now);

    List<Deal> findByBusinessIdOrderByStartsAtDescIdAsc(UUID businessId);
}
