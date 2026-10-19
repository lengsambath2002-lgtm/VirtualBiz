package com.kosign.vbiz.catalog.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A product of a shop. Its variants (and their stock) are {@link ProductVariant} rows. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "product")
public class Product extends BaseEntity {

    @Column(name = "business_id", nullable = false, updatable = false)
    private UUID businessId;

    @Column(name = "slug", length = 90, nullable = false, updatable = false)
    private String slug;

    @Column(name = "title", length = 80, nullable = false)
    private String title;

    @Column(name = "description", length = 1000, nullable = false)
    private String description = "";

    @Column(name = "category_id", length = 40, nullable = false)
    private String categoryId;

    @Column(name = "collection_id")
    private UUID collectionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 10, nullable = false)
    private ProductStatus status = ProductStatus.DRAFT;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "options", nullable = false)
    private List<ProductOption> options = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "photos", nullable = false)
    private List<String> photos = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "specs", nullable = false)
    private List<SpecRow> specs = new ArrayList<>();

    @Column(name = "low_stock_at", nullable = false)
    private int lowStockAt = 5;

    @Column(name = "sold_count", nullable = false)
    private int soldCount;

    @Column(name = "rating", precision = 2, scale = 1, nullable = false)
    private BigDecimal rating = BigDecimal.ZERO;

    @Column(name = "position", nullable = false)
    private int position;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
