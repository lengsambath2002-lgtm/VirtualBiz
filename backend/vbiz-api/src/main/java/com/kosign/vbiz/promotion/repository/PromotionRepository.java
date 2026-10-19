package com.kosign.vbiz.promotion.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kosign.vbiz.promotion.domain.Promotion;

import jakarta.persistence.LockModeType;

public interface PromotionRepository extends JpaRepository<Promotion, UUID> {

    @Query("""
            select p from Promotion p where p.businessId is null and p.startsAt <= :now and p.endsAt >= :now
            order by p.endsAt asc, p.id asc""")
    List<Promotion> activePlatform(@Param("now") Instant now);

    /** A code that is the platform's or one of these shops' (platform first). */
    @Query("""
            select p from Promotion p where p.code is not null and upper(p.code) = upper(:code)
              and (p.businessId is null or p.businessId in :shops)
            order by case when p.businessId is null then 0 else 1 end, p.endsAt desc""")
    List<Promotion> findByCode(@Param("code") String code, @Param("shops") Collection<UUID> shops);

    /** These shops' automatic promotions (no code) running now and not used up. */
    @Query("""
            select p from Promotion p where p.code is null and p.businessId in :shops
              and p.startsAt <= :now and p.endsAt >= :now
              and (p.usageLimit is null or p.uses < p.usageLimit)""")
    List<Promotion> activeAutomatic(@Param("shops") Collection<UUID> shops, @Param("now") Instant now);

    List<Promotion> findByBusinessIdOrderByStartsAtDescIdAsc(UUID businessId);

    /** VirtualBiz's own promo codes, newest first. */
    List<Promotion> findByBusinessIdIsNullOrderByStartsAtDescIdAsc();

    /** The promotion row locked while a checkout counts its use. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Promotion p where p.id = :id")
    Optional<Promotion> lockById(@Param("id") UUID id);
}
