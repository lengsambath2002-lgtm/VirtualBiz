package com.kosign.vbiz.booking.repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kosign.vbiz.booking.domain.CalendarBlock;

public interface CalendarBlockRepository extends JpaRepository<CalendarBlock, UUID> {

    @Query("""
            select b from CalendarBlock b where b.businessId = :businessId and b.date between :from and :to
            order by b.date asc, b.start asc""")
    List<CalendarBlock> ofBusiness(@Param("businessId") UUID businessId, @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    @Query("select b from CalendarBlock b where b.staffId in :staffIds and b.date between :from and :to")
    List<CalendarBlock> ofStaff(@Param("staffIds") Collection<UUID> staffIds, @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    Optional<CalendarBlock> findByIdAndBusinessId(UUID id, UUID businessId);
}
