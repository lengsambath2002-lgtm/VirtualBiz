package com.kosign.vbiz.pos.domain;

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

/** A register shift: opened with a counted float, closed with a count against the expected cash. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "pos_shift")
public class PosShift extends BaseEntity {

    @Column(name = "business_id", nullable = false, updatable = false)
    private UUID businessId;

    @Column(name = "opened_by")
    private UUID openedBy;

    @Column(name = "opened_by_name", length = 80, nullable = false)
    private String openedByName;

    @Column(name = "opened_at", nullable = false)
    private Instant openedAt;

    @Column(name = "float_usd", precision = 12, scale = 2, nullable = false)
    private BigDecimal floatUsd;

    @Column(name = "float_khr", nullable = false)
    private long floatKhr;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(name = "closed_by_name", length = 80)
    private String closedByName;

    @Column(name = "counted_usd", precision = 12, scale = 2)
    private BigDecimal countedUsd;

    @Column(name = "expected_usd", precision = 12, scale = 2)
    private BigDecimal expectedUsd;

    @Column(name = "difference", precision = 12, scale = 2)
    private BigDecimal difference;
}
