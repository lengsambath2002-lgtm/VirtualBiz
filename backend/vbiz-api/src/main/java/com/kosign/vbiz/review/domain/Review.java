package com.kosign.vbiz.review.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A listing review, written by a customer after an order or a booking (Phase 5). {@code authorName} is a snapshot. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "review")
public class Review extends BaseEntity {

    @Column(name = "business_id", nullable = false)
    private UUID businessId;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", length = 10, nullable = false)
    private ReviewTarget targetType;

    @Column(name = "target_id", nullable = false)
    private UUID targetId;

    @Column(name = "author_id")
    private UUID authorId;

    @Column(name = "author_name", length = 80, nullable = false)
    private String authorName;

    @Column(name = "stars", nullable = false)
    private int stars;

    @Column(name = "text", length = 1000, nullable = false)
    private String text = "";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tags", nullable = false)
    private List<String> tags = new ArrayList<>();

    @Column(name = "variant_name", length = 80)
    private String variantName;

    @Column(name = "verified", nullable = false)
    private boolean verified;

    @Column(name = "reply", length = 1000)
    private String reply;

    /** Set when an admin hides the review: it leaves public lists and the ratings. */
    @Column(name = "hidden_at")
    private Instant hiddenAt;

    @Column(name = "hidden_reason", length = 300)
    private String hiddenReason;

    @Column(name = "at", nullable = false)
    private Instant at;

    /** The order (products) or booking (services) the customer reviewed. */
    @Column(name = "order_id")
    private UUID orderId;

    @Column(name = "appointment_id")
    private UUID appointmentId;
}
