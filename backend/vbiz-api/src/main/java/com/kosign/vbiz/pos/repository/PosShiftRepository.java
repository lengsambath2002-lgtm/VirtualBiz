package com.kosign.vbiz.pos.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kosign.vbiz.pos.domain.PosShift;

import jakarta.persistence.LockModeType;

public interface PosShiftRepository extends JpaRepository<PosShift, UUID> {

    /** The business's open shift, locked (sales, moves and closing are serialised on it). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from PosShift s where s.businessId = :businessId and s.closedAt is null")
    Optional<PosShift> lockOpen(@Param("businessId") UUID businessId);

    @Query("select s from PosShift s where s.businessId = :businessId and s.closedAt is null")
    Optional<PosShift> findOpen(@Param("businessId") UUID businessId);

    /** The closed shift that was open at {@code at} (a sale rung up offline). */
    @Query("""
            select s from PosShift s where s.businessId = :businessId and s.openedAt <= :at
              and s.closedAt is not null and s.closedAt >= :at order by s.openedAt desc""")
    List<PosShift> openAt(@Param("businessId") UUID businessId, @Param("at") Instant at);

    @Query("""
            select s from PosShift s where s.businessId = :businessId and s.closedAt is not null
            order by s.closedAt desc""")
    List<PosShift> closed(@Param("businessId") UUID businessId, Pageable page);
}
