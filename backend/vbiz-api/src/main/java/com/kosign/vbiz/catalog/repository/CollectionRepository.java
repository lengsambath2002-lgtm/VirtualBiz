package com.kosign.vbiz.catalog.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kosign.vbiz.catalog.domain.Collection;

public interface CollectionRepository extends JpaRepository<Collection, UUID> {

    List<Collection> findByBusinessIdOrderByPositionAscNameAsc(UUID businessId);

    @Query("select c from Collection c where c.businessId = :businessId and lower(c.name) = lower(:name)")
    Optional<Collection> findByName(@Param("businessId") UUID businessId, @Param("name") String name);

    @Query("select coalesce(max(c.position), -1) from Collection c where c.businessId = :businessId")
    int maxPosition(@Param("businessId") UUID businessId);
}
