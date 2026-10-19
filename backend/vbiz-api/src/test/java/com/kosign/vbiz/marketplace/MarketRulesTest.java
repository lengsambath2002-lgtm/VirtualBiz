package com.kosign.vbiz.marketplace;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.domain.Closure;
import com.kosign.vbiz.business.domain.ProductSettings;
import com.kosign.vbiz.marketplace.service.MarketRules;

class MarketRulesTest {

    private static Business shop() {
        Business b = new Business();
        List<List<Integer>> week = new ArrayList<>(Collections.nCopies(6, List.of(540, 1200)));
        week.add(null);
        b.setHours(week);
        b.setClosures(new ArrayList<>());
        return b;
    }

    @Test
    void open_now_uses_phnom_penh_time_and_closures() {
        Business b = shop();
        // Wednesday 2026-10-14 03:00 UTC = 10:00 in Phnom Penh
        assertThat(MarketRules.isOpen(b, ZonedDateTime.parse("2026-10-14T03:00:00Z"))).isTrue();
        assertThat(MarketRules.isOpen(b, ZonedDateTime.parse("2026-10-14T13:00:00Z"))).isFalse(); // 20:00
        assertThat(MarketRules.isOpen(b, ZonedDateTime.parse("2026-10-18T03:00:00Z"))).isFalse(); // Sunday
        b.setClosures(List.of(new Closure("2026-10-14", "Holiday")));
        assertThat(MarketRules.isOpen(b, ZonedDateTime.parse("2026-10-14T03:00:00Z"))).isFalse();
    }

    @Test
    void zone_fee_falls_into_the_last_zone() {
        ProductSettings s = new ProductSettings(true, 20, 5, true, true, new BigDecimal("25"),
                ProductSettings.DEFAULT_ZONES);
        assertThat(MarketRules.zoneFee(s, "BKK1")).isEqualByComparingTo("0.75");
        assertThat(MarketRules.zoneFee(s, "Sen Sok")).isEqualByComparingTo("1.50");
        assertThat(MarketRules.zoneFee(s, "Kandal")).isEqualByComparingTo("2.50");
    }

    @Test
    void haversine_and_discount() {
        assertThat(MarketRules.km(11.5, 104.9, 11.5, 104.9)).isEqualTo(0.1);
        assertThat(MarketRules.km(11.577, 104.9, 11.548, 104.929)).isBetween(4.0, 5.0);
        assertThat(MarketRules.discounted(new BigDecimal("25.00"), 15)).isEqualByComparingTo("21.25");
        assertThat(MarketRules.discounted(new BigDecimal("25.00"), null)).isEqualByComparingTo("25.00");
    }
}
