package com.kosign.vbiz.catalog.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kosign.vbiz.catalog.domain.Product;
import com.kosign.vbiz.catalog.domain.ProductStatus;

public interface ProductRepository extends JpaRepository<Product, UUID> {

    /** Live products of a shop, newest first (seller list). */
    List<Product> findByBusinessIdAndDeletedAtIsNullOrderByCreatedAtDescIdAsc(UUID businessId);

    Optional<Product> findByIdAndBusinessIdAndDeletedAtIsNull(UUID id, UUID businessId);

    /** Listed products of the given shops in shop order. */
    @Query("""
            select p from Product p
            where p.businessId in :businessIds and p.status = :status and p.deletedAt is null
            order by p.position asc, p.createdAt asc, p.id asc""")
    List<Product> findListed(@Param("businessIds") Collection<UUID> businessIds,
            @Param("status") ProductStatus status);

    Optional<Product> findBySlugAndDeletedAtIsNull(String slug);

    boolean existsBySlug(String slug);

    @Query("select coalesce(max(p.position), -1) from Product p where p.businessId = :businessId")
    int maxPosition(@Param("businessId") UUID businessId);

    @Query("""
            select p.collectionId, count(p) from Product p
            where p.businessId = :businessId and p.deletedAt is null and p.collectionId is not null
            group by p.collectionId""")
    List<Object[]> countByCollection(@Param("businessId") UUID businessId);

    boolean existsByBusinessIdAndCollectionIdIsNotNull(UUID businessId);

    /** Moves every product of collection {@code from} to {@code to} (null = no collection). */
    @org.springframework.data.jpa.repository.Modifying
    @Query("update Product p set p.collectionId = :to where p.businessId = :businessId and p.collectionId = :from")
    int moveCollection(@Param("businessId") UUID businessId, @Param("from") UUID from, @Param("to") UUID to);
}
