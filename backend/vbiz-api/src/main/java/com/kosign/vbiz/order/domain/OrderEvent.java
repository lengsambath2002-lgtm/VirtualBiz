package com.kosign.vbiz.order.domain;

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

/** A timeline entry: a status reached, or a non-step event ({@code note}, e.g. "failed.noAnswer"). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "order_event")
public class OrderEvent extends BaseEntity {

    @Column(name = "order_id", nullable = false, updatable = false)
    private UUID orderId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 10, nullable = false)
    private OrderStatus status;

    @Column(name = "note", length = 40)
    private String note;

    @Column(name = "by_user_id")
    private UUID byUserId;

    @Column(name = "at", nullable = false)
    private Instant at;
}
