package com.kosign.vbiz.catalog.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kosign.vbiz.catalog.domain.ProductVariant;

import jakarta.persistence.LockModeType;

public interface ProductVariantRepository extends JpaRepository<ProductVariant, UUID> {

    @Query("""
            select v from ProductVariant v
            where v.productId in :productIds and v.deletedAt is null
            order by v.productId asc, v.position asc, v.id asc""")
    List<ProductVariant> findLiveByProductIds(@Param("productIds") Collection<UUID> productIds);

    /** The variant row locked for a stock change (the stock writer serialises on it). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select v from ProductVariant v where v.id = :id and v.businessId = :businessId")
    Optional<ProductVariant> lockForStock(@Param("id") UUID id, @Param("businessId") UUID businessId);

    Optional<ProductVariant> findByIdAndBusinessId(UUID id, UUID businessId);

    @Query("""
            select count(v) > 0 from ProductVariant v
            where v.businessId = :businessId and lower(v.sku) = lower(:sku) and v.deletedAt is null
              and v.productId <> :exceptProduct""")
    boolean skuTaken(@Param("businessId") UUID businessId, @Param("sku") String sku,
            @Param("exceptProduct") UUID exceptProduct);

    @Query("""
            select count(v) > 0 from ProductVariant v
            where v.businessId = :businessId and v.barcode = :barcode and v.deletedAt is null
              and v.productId <> :exceptProduct""")
    boolean barcodeTaken(@Param("businessId") UUID businessId, @Param("barcode") String barcode,
            @Param("exceptProduct") UUID exceptProduct);

    @Query("""
            select count(v) > 0 from ProductVariant v
            where v.businessId = :businessId and v.barcode = :barcode and v.deletedAt is null""")
    boolean barcodeUsed(@Param("businessId") UUID businessId, @Param("barcode") String barcode);
}
