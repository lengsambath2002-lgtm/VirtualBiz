package com.kosign.vbiz.order.domain;

import java.math.BigDecimal;
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

/** One {@code POST /api/checkout}: its idempotency key and the orders (one per shop) it placed. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "checkout")
public class Checkout extends BaseEntity {

    @Column(name = "customer_id", nullable = false, updatable = false)
    private UUID customerId;

    @Column(name = "idempotency_key", length = 64, nullable = false, updatable = false)
    private String idempotencyKey;

    @Column(name = "request_hash", length = 64, nullable = false, updatable = false)
    private String requestHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", length = 10, nullable = false, updatable = false)
    private PaymentMethod paymentMethod;

    @Column(name = "total", precision = 12, scale = 2, nullable = false)
    private BigDecimal total;
}
