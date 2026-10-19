package com.kosign.vbiz.catalog.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kosign.vbiz.catalog.domain.ServiceItem;

public interface ServiceItemRepository extends JpaRepository<ServiceItem, UUID> {

    List<ServiceItem> findByBusinessIdAndDeletedAtIsNullOrderByPositionAscCreatedAtAsc(UUID businessId);

    Optional<ServiceItem> findByIdAndBusinessIdAndDeletedAtIsNull(UUID id, UUID businessId);

    @Query("""
            select s from ServiceItem s
            where s.businessId in :businessIds and s.bookableOnline = true and s.deletedAt is null
            order by s.position asc, s.createdAt asc, s.id asc""")
    List<ServiceItem> findListed(@Param("businessIds") Collection<UUID> businessIds);

    Optional<ServiceItem> findBySlugAndDeletedAtIsNull(String slug);

    boolean existsBySlug(String slug);

    @Query("""
            select count(s) > 0 from ServiceItem s
            where s.businessId = :businessId and lower(s.name) = lower(:name) and s.deletedAt is null
              and s.id <> :except""")
    boolean nameTaken(@Param("businessId") UUID businessId, @Param("name") String name,
            @Param("except") UUID except);

    @Query("select coalesce(max(s.position), -1) from ServiceItem s where s.businessId = :businessId")
    int maxPosition(@Param("businessId") UUID businessId);
}
