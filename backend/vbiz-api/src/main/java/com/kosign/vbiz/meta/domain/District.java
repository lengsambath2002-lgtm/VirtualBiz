package com.kosign.vbiz.meta.domain;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Phnom Penh district (reference data, seeded by Flyway; open question #10). {@code km} is the
 * distance from the city centre, used for distance sorting. IDs are stable slugs such as
 * {@code toul-kork}.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "district")
public class District {

    @Id
    @Column(name = "id", length = 40, nullable = false, updatable = false)
    private String id;

    @Column(name = "name", length = 80, nullable = false)
    private String name;

    @Column(name = "km", precision = 4, scale = 1, nullable = false)
    private BigDecimal km;

    /** Centre of the district (distance origin). */
    @Column(name = "lat", precision = 9, scale = 6)
    private BigDecimal lat;

    @Column(name = "lng", precision = 9, scale = 6)
    private BigDecimal lng;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
}
