package com.kosign.vbiz.meta.domain;

import com.kosign.vbiz.business.domain.BusinessType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Platform category (reference data, seeded by Flyway). Open question #11: platform categories
 * are the marketplace level; shop-defined collections are a separate, per-business concept.
 * {@code inMarketplace} marks the ones shown in the marketplace category bar; all are offered
 * when a business is created (filtered by {@code businessType}). A super-admin adds, renames,
 * hides and reorders them from the console; the id never changes (businesses point at it).
 */
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "category")
public class Category {

    @Id
    @Column(name = "id", length = 40, nullable = false, updatable = false)
    private String id;

    @Column(name = "name", length = 80, nullable = false)
    private String name;

    @Column(name = "name_kh", length = 80, nullable = false)
    private String nameKh;

    @Column(name = "icon", length = 40, nullable = false)
    private String icon;

    /** Colour slot 1–6 of the shared design tokens ({@code .t1} … {@code .t6}). */
    @Column(name = "tint", nullable = false)
    private short tint;

    @Enumerated(EnumType.STRING)
    @Column(name = "business_type", length = 20, nullable = false)
    private BusinessType businessType;

    @Column(name = "in_marketplace", nullable = false)
    private boolean inMarketplace;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    public static Category create(String id, BusinessType type) {
        Category c = new Category();
        c.id = id;
        c.businessType = type;
        return c;
    }
}
