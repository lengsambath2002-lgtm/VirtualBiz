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
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A sellable variant (one cell of the option matrix). {@code optionValues} follow the product's
 * option order. {@code stock} has no setter: it changes only through
 * {@code inventory.service.StockWriter}, which also writes the movement (ArchitectureTest).
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "product_variant")
public class ProductVariant extends BaseEntity {

    @Column(name = "product_id", nullable = false, updatable = false)
    private UUID productId;

    @Column(name = "business_id", nullable = false, updatable = false)
    private UUID businessId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "option_values", nullable = false)
    private List<String> optionValues = new ArrayList<>();

    @Column(name = "price", precision = 12, scale = 2, nullable = false)
    private BigDecimal price;

    @Column(name = "compare_at", precision = 12, scale = 2)
    private BigDecimal compareAt;

    @Column(name = "cost", precision = 12, scale = 2)
    private BigDecimal cost;

    @Column(name = "sku", length = 40, nullable = false)
    private String sku = "";

    @Column(name = "barcode", length = 40, nullable = false)
    private String barcode;

    @Setter(AccessLevel.NONE)
    @Column(name = "stock", nullable = false)
    private int stock;

    @Column(name = "swatch", length = 9)
    private String swatch;

    @Column(name = "position", nullable = false)
    private int position;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    /** Applies a stock change. Only the inventory stock writer calls this (it logs the movement). */
    public void adjustStock(int delta) {
        this.stock += delta;
    }
}
