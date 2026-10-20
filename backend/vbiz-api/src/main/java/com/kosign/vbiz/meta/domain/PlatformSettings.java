package com.kosign.vbiz.meta.domain;

import java.math.BigDecimal;
import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * The platform's adjustable numbers (one row, id 1): commission, payout delay and the riel rate.
 * Changed only by a super-admin from the console; each change is audited.
 */
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "platform_settings")
public class PlatformSettings {

    public static final short ID = 1;

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private short id;

    @Column(name = "commission_pct", precision = 4, scale = 2, nullable = false)
    private BigDecimal commissionPct;

    @Column(name = "payout_delay_days", nullable = false)
    private short payoutDelayDays;

    @Column(name = "khr_per_usd", nullable = false)
    private int khrPerUsd;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by", length = 80)
    private String updatedBy;
}
