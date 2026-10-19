package com.kosign.vbiz.order.domain;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A line of an order, with the product as it was at checkout. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "order_line")
public class OrderLine extends BaseEntity {

    @Column(name = "order_id", nullable = false, updatable = false)
    private UUID orderId;

    @Column(name = "variant_id", nullable = false, updatable = false)
    private UUID variantId;

    @Column(name = "product_id", nullable = false, updatable = false)
    private UUID productId;

    @Column(name = "product_slug", length = 90, nullable = false)
    private String productSlug;

    @Column(name = "title", length = 80, nullable = false)
    private String title;

    @Column(name = "variant_name", length = 120, nullable = false)
    private String variantName = "";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "options", nullable = false)
    private Map<String, String> options = new LinkedHashMap<>();

    @Column(name = "sku", length = 40, nullable = false)
    private String sku = "";

    @Column(name = "qty", nullable = false)
    private int qty;

    /** Price before the shop's discount (compare-at when higher). */
    @Column(name = "list_price", precision = 12, scale = 2, nullable = false)
    private BigDecimal listPrice;

    /** What the customer pays per unit. */
    @Column(name = "unit_price", precision = 12, scale = 2, nullable = false)
    private BigDecimal unitPrice;

    @Column(name = "position", nullable = false)
    private int position;
}
