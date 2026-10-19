package com.kosign.vbiz.promotion.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A shop's deal / event in the marketplace feed. {@code serviceIds}: services it applies to. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "deal")
public class Deal extends BaseEntity {

    @Column(name = "business_id", nullable = false)
    private UUID businessId;

    @Column(name = "title", length = 120, nullable = false)
    private String title;

    @Column(name = "body", length = 500, nullable = false)
    private String body;

    @Column(name = "discount_pct")
    private Integer discountPct;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "service_ids", nullable = false)
    private List<String> serviceIds = new ArrayList<>();

    @Column(name = "starts_at", nullable = false)
    private Instant startsAt;

    @Column(name = "ends_at", nullable = false)
    private Instant endsAt;

    @Column(name = "views", nullable = false)
    private int views;
}
