package com.kosign.vbiz.pos.domain;

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

/** How (part of) a sale was paid; a split payment is several rows. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "sale_payment")
public class SalePayment extends BaseEntity {

    @Column(name = "sale_id", nullable = false, updatable = false)
    private UUID saleId;

    @Column(name = "position", nullable = false)
    private int position;

    @Enumerated(EnumType.STRING)
    @Column(name = "method", length = 10, nullable = false)
    private PaymentMethod method;

    @Column(name = "amount", precision = 12, scale = 2, nullable = false)
    private BigDecimal amount;
}
