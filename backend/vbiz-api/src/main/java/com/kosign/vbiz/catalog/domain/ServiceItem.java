package com.kosign.vbiz.catalog.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A bookable service of a provider (domain {@code Service}; table {@code service}). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "service")
public class ServiceItem extends BaseEntity {

    @Column(name = "business_id", nullable = false, updatable = false)
    private UUID businessId;

    @Column(name = "slug", length = 90, nullable = false, updatable = false)
    private String slug;

    @Column(name = "name", length = 80, nullable = false)
    private String name;

    @Column(name = "category", length = 40, nullable = false)
    private String category;

    @Column(name = "description", length = 500, nullable = false)
    private String description = "";

    @Column(name = "duration_min", nullable = false)
    private int durationMin;

    @Column(name = "price", precision = 12, scale = 2, nullable = false)
    private BigDecimal price;

    @Column(name = "discount_pct")
    private Integer discountPct;

    @Column(name = "bookable_online", nullable = false)
    private boolean bookableOnline = true;

    @Column(name = "sold_count", nullable = false)
    private int soldCount;

    @Column(name = "rating", precision = 2, scale = 1, nullable = false)
    private BigDecimal rating = BigDecimal.ZERO;

    @Column(name = "position", nullable = false)
    private int position;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    /** Business members who perform the service. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "service_staff", joinColumns = @JoinColumn(name = "service_id"))
    @Column(name = "member_id")
    private Set<UUID> staffIds = new LinkedHashSet<>();
}
