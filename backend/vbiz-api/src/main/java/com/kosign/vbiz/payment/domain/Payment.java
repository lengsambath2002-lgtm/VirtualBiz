package com.kosign.vbiz.payment.domain;

import java.math.BigDecimal;
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

/** One order's payment: method × channel, amount, the 5% online commission and the payout target. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "payment")
public class Payment extends BaseEntity {

    @Column(name = "order_id", nullable = false, updatable = false)
    private UUID orderId;

    @Column(name = "intent_id")
    private UUID intentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "method", length = 10, nullable = false)
    private PaymentMethod method;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", length = 10, nullable = false)
    private PaymentChannel channel;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 10, nullable = false)
    private PaymentStatus status = PaymentStatus.PENDING;

    @Column(name = "amount", precision = 12, scale = 2, nullable = false)
    private BigDecimal amount;

    @Column(name = "commission", precision = 12, scale = 2, nullable = false)
    private BigDecimal commission;

    @Column(name = "payout_to", length = 100)
    private String payoutTo;

    @Column(name = "paid_at")
    private Instant paidAt;

    @Column(name = "refunded_at")
    private Instant refundedAt;
}
