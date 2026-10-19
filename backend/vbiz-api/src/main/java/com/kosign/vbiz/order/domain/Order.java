package com.kosign.vbiz.order.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.kosign.vbiz.common.persistence.BaseEntity;
import com.kosign.vbiz.delivery.domain.DeliveryProvider;
import com.kosign.vbiz.delivery.domain.Rider;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One shop's order (checkout makes one per shop). {@code placedAt} is when the shop could see it
 * (a KHQR order only once paid); the 1-hour auto-cancel counts from it. Status changes go through
 * {@link OrderStatus#transitionTo(OrderStatus, FulfilmentMethod)}.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "orders")
public class Order extends BaseEntity {

    @Column(name = "number", length = 12, nullable = false, updatable = false)
    private String number;

    @Column(name = "checkout_id")
    private UUID checkoutId;

    @Column(name = "business_id", nullable = false, updatable = false)
    private UUID businessId;

    @Column(name = "customer_id", nullable = false, updatable = false)
    private UUID customerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 10, nullable = false)
    private OrderStatus status = OrderStatus.NEW;

    @Enumerated(EnumType.STRING)
    @Column(name = "method", length = 10, nullable = false, updatable = false)
    private FulfilmentMethod method;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "address")
    private OrderAddress address;

    @Column(name = "delivery_window", length = 11)
    private String deliveryWindow;

    @Column(name = "scheduled_for")
    private Instant scheduledFor;

    @Column(name = "note", length = 120)
    private String note;

    @Column(name = "subtotal", precision = 12, scale = 2, nullable = false)
    private BigDecimal subtotal;

    @Column(name = "discount", precision = 12, scale = 2, nullable = false)
    private BigDecimal discount;

    @Column(name = "promo_discount", precision = 12, scale = 2, nullable = false)
    private BigDecimal promoDiscount;

    @Column(name = "promo_code", length = 30)
    private String promoCode;

    @Column(name = "promotion_id")
    private UUID promotionId;

    @Column(name = "delivery_fee", precision = 12, scale = 2, nullable = false)
    private BigDecimal deliveryFee;

    @Column(name = "total", precision = 12, scale = 2, nullable = false)
    private BigDecimal total;

    @Enumerated(EnumType.STRING)
    @Column(name = "delivery_by", length = 20)
    private DeliveryProvider deliveryBy;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "rider")
    private Rider rider;

    @Column(name = "cancel_reason", length = 40)
    private String cancelReason;

    @Column(name = "reviewed", nullable = false)
    private boolean reviewed;

    @Column(name = "placed_at")
    private Instant placedAt;

    @Column(name = "accepted_at")
    private Instant acceptedAt;

    @Column(name = "packed_at")
    private Instant packedAt;

    @Column(name = "shipped_at")
    private Instant shippedAt;

    @Column(name = "fulfilled_at")
    private Instant fulfilledAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "returned_at")
    private Instant returnedAt;
}
