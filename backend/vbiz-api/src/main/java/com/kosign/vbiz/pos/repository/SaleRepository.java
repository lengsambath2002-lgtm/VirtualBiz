package com.kosign.vbiz.pos.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kosign.vbiz.pos.domain.Sale;

public interface SaleRepository extends JpaRepository<Sale, UUID> {

    @Query(value = "select nextval('sale_number_seq')", nativeQuery = true)
    long nextNumber();

    @Query(value = "select nextval('receipt_number_seq')", nativeQuery = true)
    long nextReceipt();

    Optional<Sale> findByNumber(String number);

    Optional<Sale> findByShareToken(String shareToken);

    Optional<Sale> findByBusinessIdAndClientRef(UUID businessId, UUID clientRef);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Sale s where s.id = :id")
    Optional<Sale> lockById(@Param("id") UUID id);

    List<Sale> findByShiftIdIn(java.util.Collection<UUID> shiftIds);

    /** Counter receipts (R-…) of the business in a time window, newest first. */
    @Query("""
            select s from Sale s where s.businessId = :businessId and s.number like 'R-%'
              and s.at >= :from and s.at < :to order by s.at desc, s.number desc""")
    List<Sale> receipts(@Param("businessId") UUID businessId, @Param("from") Instant from, @Param("to") Instant to);

    @Query("""
            select s from Sale s where s.businessId = :businessId and s.at >= :from and s.at < :to
            order by s.at desc, s.number desc""")
    List<Sale> ofBusiness(@Param("businessId") UUID businessId, @Param("from") Instant from, @Param("to") Instant to);
}
