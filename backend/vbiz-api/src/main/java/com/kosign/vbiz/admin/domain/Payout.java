package com.kosign.vbiz.admin.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One transfer to a shop's Bakong account ({@code payout}): the released online payments it
 * settles, less refunds taken back, less VirtualBiz's commission.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "payout")
public class Payout extends BaseEntity {

    @Column(name = "business_id", nullable = false, updatable = false)
    private UUID businessId;

    @Column(name = "gross", precision = 12, scale = 2, nullable = false, updatable = false)
    private BigDecimal gross;

    @Column(name = "commission", precision = 12, scale = 2, nullable = false, updatable = false)
    private BigDecimal commission;

    @Column(name = "amount", precision = 12, scale = 2, nullable = false, updatable = false)
    private BigDecimal amount;

    @Column(name = "payments_count", nullable = false, updatable = false)
    private int paymentsCount;

    @Column(name = "bakong_id", length = 100, nullable = false, updatable = false)
    private String bakongId;

    /** The bank transfer's reference, as the admin typed it. */
    @Column(name = "reference", length = 80, nullable = false, updatable = false)
    private String reference;

    @Column(name = "note", length = 300, updatable = false)
    private String note;

    @Column(name = "paid_at", nullable = false, updatable = false)
    private Instant paidAt;

    @Column(name = "paid_by", updatable = false)
    private UUID paidBy;
}
