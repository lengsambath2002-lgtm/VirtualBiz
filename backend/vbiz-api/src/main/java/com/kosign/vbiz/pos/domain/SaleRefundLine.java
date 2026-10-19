package com.kosign.vbiz.pos.domain;

import java.util.UUID;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** How many of a variant a refund covers. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "sale_refund_line")
public class SaleRefundLine extends BaseEntity {

    @Column(name = "refund_id", nullable = false, updatable = false)
    private UUID refundId;

    @Column(name = "variant_id", nullable = false)
    private UUID variantId;

    @Column(name = "qty", nullable = false)
    private int qty;
}
