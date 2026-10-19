package com.kosign.vbiz.delivery.service;

import java.math.BigDecimal;

import com.kosign.vbiz.business.domain.DeliveryZone;
import com.kosign.vbiz.business.domain.ProductSettings;
import com.kosign.vbiz.common.helper.Money;
import com.kosign.vbiz.order.domain.FulfilmentMethod;

/**
 * Per-shop delivery fee (domain-model.md § Delivery, open question #7), mirroring
 * {@code frontend/src/lib/pricing/delivery.ts}: pickup is free; delivery is free when the shop's
 * item total reaches {@code freeDeliveryOver}; otherwise the zone fee of the district, a district
 * in no zone falling into the last ("further") zone; a shop without zones delivers free.
 */
public final class DeliveryFees {

    private DeliveryFees() {
    }

    public static BigDecimal fee(ProductSettings s, String district, BigDecimal shopTotal, FulfilmentMethod method) {
        if (method == FulfilmentMethod.PICKUP || s == null || s.zones() == null || s.zones().isEmpty()) {
            return Money.ZERO;
        }
        if (s.freeDeliveryOver() != null && shopTotal.compareTo(s.freeDeliveryOver()) >= 0) {
            return Money.ZERO;
        }
        DeliveryZone zone = s.zones().stream()
                .filter(z -> district != null && z.districts() != null && z.districts().contains(district))
                .findFirst()
                .orElse(s.zones().get(s.zones().size() - 1));
        return zone.fee() == null ? Money.ZERO : Money.usd(zone.fee());
    }

    /** What the customer still has to add for free delivery (0 when free already or no threshold). */
    public static BigDecimal toFree(ProductSettings s, BigDecimal shopTotal) {
        if (s == null || s.freeDeliveryOver() == null) {
            return Money.ZERO;
        }
        BigDecimal gap = s.freeDeliveryOver().subtract(shopTotal);
        return gap.signum() > 0 ? Money.usd(gap) : Money.ZERO;
    }
}
