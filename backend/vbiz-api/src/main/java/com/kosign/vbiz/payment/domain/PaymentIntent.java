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

/** One KHQR or card session covering every order of a checkout. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "payment_intent")
public class PaymentIntent extends BaseEntity {

    @Column(name = "checkout_id", nullable = false, updatable = false)
    private UUID checkoutId;

    @Column(name = "customer_id", nullable = false, updatable = false)
    private UUID customerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "method", length = 10, nullable = false, updatable = false)
    private PaymentMethod method;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 10, nullable = false)
    private IntentStatus status = IntentStatus.PENDING;

    @Column(name = "amount", precision = 12, scale = 2, nullable = false)
    private BigDecimal amount;

    @Column(name = "khqr", columnDefinition = "text")
    private String khqr;

    @Column(name = "khqr_md5", length = 32)
    private String khqrMd5;

    @Column(name = "gateway_ref", length = 80)
    private String gatewayRef;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "paid_at")
    private Instant paidAt;
}
