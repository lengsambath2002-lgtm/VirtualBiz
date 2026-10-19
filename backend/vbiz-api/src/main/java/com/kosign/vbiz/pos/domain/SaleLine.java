package com.kosign.vbiz.pos.domain;

import java.math.BigDecimal;
import java.util.UUID;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One line of a sale: a service (with who did it) or a retail variant, or a free-text item. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "sale_line")
public class SaleLine extends BaseEntity {

    @Column(name = "sale_id", nullable = false, updatable = false)
    private UUID saleId;

    @Column(name = "position", nullable = false)
    private int position;

    @Column(name = "service_id")
    private UUID serviceId;

    @Column(name = "variant_id")
    private UUID variantId;

    @Column(name = "product_id")
    private UUID productId;

    @Column(name = "variant_name", length = 80)
    private String variantName;

    @Column(name = "title", length = 160, nullable = false)
    private String title;

    @Column(name = "qty", nullable = false)
    private int qty;

    @Column(name = "unit_price", precision = 12, scale = 2, nullable = false)
    private BigDecimal unitPrice;

    @Column(name = "staff_id")
    private UUID staffId;
}
