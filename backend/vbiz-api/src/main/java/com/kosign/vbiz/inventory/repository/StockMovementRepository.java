package com.kosign.vbiz.inventory.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kosign.vbiz.inventory.domain.StockMovement;

public interface StockMovementRepository extends JpaRepository<StockMovement, UUID>,
        JpaSpecificationExecutor<StockMovement> {

    @Query("""
            select m from StockMovement m where m.businessId = :businessId
            order by m.at desc, m.createdAt desc, m.id desc""")
    List<StockMovement> latest(@Param("businessId") UUID businessId, Pageable page);

    @Query("""
            select m from StockMovement m where m.businessId = :businessId and m.variantId = :variantId
            order by m.at desc, m.createdAt desc, m.id desc""")
    List<StockMovement> latestOfVariant(@Param("businessId") UUID businessId,
            @Param("variantId") UUID variantId, Pageable page);

    @Query("""
            select m from StockMovement m where m.businessId = :businessId
              and m.variantId in (select v.id from ProductVariant v where v.productId = :productId)
            order by m.at desc, m.createdAt desc, m.id desc""")
    List<StockMovement> latestOfProduct(@Param("businessId") UUID businessId,
            @Param("productId") UUID productId, Pageable page);

    Optional<StockMovement> findByIdAndBusinessId(UUID id, UUID businessId);

    @Query("select coalesce(sum(m.delta), 0) from StockMovement m where m.variantId = :variantId")
    long sumOfVariant(@Param("variantId") UUID variantId);
}
