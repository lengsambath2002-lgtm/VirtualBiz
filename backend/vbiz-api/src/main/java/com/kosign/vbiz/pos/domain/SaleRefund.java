package com.kosign.vbiz.pos.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.kosign.vbiz.common.persistence.BaseEntity;
import com.kosign.vbiz.payment.domain.PaymentMethod;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Money given back for (part of) a counter sale; {@code restock} put the items back on the shelf. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "sale_refund")
public class SaleRefund extends BaseEntity {

    @Column(name = "sale_id", nullable = false, updatable = false)
    private UUID saleId;

    @Column(name = "shift_id")
    private UUID shiftId;

    @Column(name = "amount", precision = 12, scale = 2, nullable = false)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "method", length = 10, nullable = false)
    private PaymentMethod method;

    @Column(name = "restock", nullable = false)
    private boolean restock;

    @Column(name = "by_user_id")
    private UUID byUserId;

    @Column(name = "by_name", length = 80)
    private String byName;

    @Column(name = "at", nullable = false)
    private Instant at;
}
