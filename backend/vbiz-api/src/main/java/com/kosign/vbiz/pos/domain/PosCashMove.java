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

/** Cash put into (positive) or taken out of (negative) the drawer during a shift. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "pos_cash_move")
public class PosCashMove extends BaseEntity {

    @Column(name = "shift_id", nullable = false, updatable = false)
    private UUID shiftId;

    @Column(name = "amount", precision = 12, scale = 2, nullable = false)
    private BigDecimal amount;

    @Column(name = "note", length = 80, nullable = false)
    private String note = "";

    @Column(name = "by_user_id")
    private UUID byUserId;

    @Column(name = "by_name", length = 80)
    private String byName;

    @Column(name = "at", nullable = false)
    private Instant at;
}
