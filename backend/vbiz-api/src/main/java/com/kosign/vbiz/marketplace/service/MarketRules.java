package com.kosign.vbiz.marketplace.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.domain.Closure;
import com.kosign.vbiz.business.domain.DeliveryZone;
import com.kosign.vbiz.business.domain.ProductSettings;

/** Pure marketplace rules: open now, zone fee, distance (mirrors frontend shop-shared/rules.ts). */
public final class MarketRules {

    public static final ZoneId PHNOM_PENH = ZoneId.of("Asia/Phnom_Penh");
    private static final double EARTH_KM = 6371.0;

    private MarketRules() {
    }

    /** Open at {@code now} (Phnom Penh): today's [open, close) range, not a closure day. */
    public static boolean isOpen(Business b, ZonedDateTime now) {
        ZonedDateTime local = now.withZoneSameInstant(PHNOM_PENH);
        LocalDate day = local.toLocalDate();
        List<Closure> closures = b.getClosures();
        if (closures != null && closures.stream().anyMatch(c -> day.toString().equals(c.date()))) {
            return false;
        }
        List<List<Integer>> hours = b.getHours();
        int idx = local.getDayOfWeek().getValue() - 1;
        if (hours == null || hours.size() <= idx || hours.get(idx) == null || hours.get(idx).size() != 2) {
            return false;
        }
        int minute = local.getHour() * 60 + local.getMinute();
        return minute >= hours.get(idx).get(0) && minute < hours.get(idx).get(1);
    }

    /**
     * Zone fee to a district before the free-over rule (a district in no zone falls into the last
     * zone); 0 when the shop has no zones. Mirrors {@code deliveryFee(..., subtotal: 0)}.
     */
    public static BigDecimal zoneFee(ProductSettings s, String district) {
        if (s == null || s.zones() == null || s.zones().isEmpty()) {
            return BigDecimal.ZERO;
        }
        if (s.freeDeliveryOver() != null && s.freeDeliveryOver().signum() <= 0) {
            return BigDecimal.ZERO;
        }
        DeliveryZone zone = s.zones().stream()
                .filter(z -> z.districts() != null && z.districts().contains(district)).findFirst()
                .orElse(s.zones().get(s.zones().size() - 1));
        return zone.fee() == null ? BigDecimal.ZERO : zone.fee();
    }

    /** Haversine km, one decimal, at least 0.1. */
    public static double km(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double d = 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
        return Math.max(0.1, BigDecimal.valueOf(d).setScale(1, RoundingMode.HALF_UP).doubleValue());
    }

    /** Net price after a whole-percent discount, to the cent. */
    public static BigDecimal discounted(BigDecimal price, Integer pct) {
        if (pct == null || pct == 0) {
            return price;
        }
        return price.multiply(BigDecimal.valueOf(100 - pct)).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }
}
