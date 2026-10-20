package com.kosign.vbiz.business.domain;

import java.math.BigDecimal;
import java.util.List;

/** Settings of a {@code PRODUCT} business (Seller workspace). Stored as JSONB. */
public record ProductSettings(
        Boolean autoAccept,
        Integer prepMinutes,
        Integer lowStockDefault,
        Boolean pickup,
        Boolean cod,
        BigDecimal freeDeliveryOver,
        List<DeliveryZone> zones,
        /** Days after delivery or pickup a return is accepted (0–30; default 7). */
        Integer returnDays) {

    public static final int DEFAULT_RETURN_DAYS = 7;

    /** Without a return window (the default applies). */
    public ProductSettings(Boolean autoAccept, Integer prepMinutes, Integer lowStockDefault, Boolean pickup,
            Boolean cod, BigDecimal freeDeliveryOver, List<DeliveryZone> zones) {
        this(autoAccept, prepMinutes, lowStockDefault, pickup, cod, freeDeliveryOver, zones, null);
    }

    public int returnDaysOrDefault() {
        return returnDays == null ? DEFAULT_RETURN_DAYS : returnDays;
    }

    /** Seller prototype's three zones (open question #7). */
    public static final List<DeliveryZone> DEFAULT_ZONES = List.of(
            new DeliveryZone("BKK1 · Chamkar Mon · Daun Penh",
                    List.of("BKK1", "Chamkar Mon", "Daun Penh"), new BigDecimal("0.75")),
            new DeliveryZone("Toul Kork · Sen Sok · Russey Keo",
                    List.of("Toul Kork", "Sen Sok", "Russey Keo"), new BigDecimal("1.50")),
            new DeliveryZone("Chbar Ampov · Mean Chey · further",
                    List.of("Chbar Ampov", "Mean Chey", "Por Senchey", "Prampi Makara"), new BigDecimal("2.50")));

    /** Defaults for a new shop (Create Business). */
    public static ProductSettings defaults() {
        return new ProductSettings(false, 20, 5, true, true, null, DEFAULT_ZONES, DEFAULT_RETURN_DAYS);
    }
}
