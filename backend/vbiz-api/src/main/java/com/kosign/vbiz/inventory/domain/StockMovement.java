package com.kosign.vbiz.inventory.domain;

import java.time.Instant;
import java.util.UUID;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One row of the shop's single stock-movement log. {@code byUserId} null = automatic ("System"). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "stock_movement")
public class StockMovement extends BaseEntity {

    @Column(name = "business_id", nullable = false, updatable = false)
    private UUID businessId;

    @Column(name = "variant_id", nullable = false, updatable = false)
    private UUID variantId;

    @Column(name = "delta", nullable = false)
    private int delta;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason", length = 20, nullable = false, updatable = false)
    private StockReason reason;

    @Column(name = "by_user_id")
    private UUID byUserId;

    @Column(name = "by_name", length = 80)
    private String byName;

    @Column(name = "note", length = 120)
    private String note;

    @Column(name = "at", nullable = false)
    private Instant at;
}
