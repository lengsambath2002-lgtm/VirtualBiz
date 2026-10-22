package com.kosign.vbiz.promotion;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.kosign.vbiz.promotion.domain.Promotion;
import com.kosign.vbiz.promotion.domain.PromotionScope;
import com.kosign.vbiz.promotion.domain.PromotionType;
import com.kosign.vbiz.promotion.service.PromoEngine;
import com.kosign.vbiz.promotion.service.PromoEngine.PromoLine;
import com.kosign.vbiz.promotion.service.PromoEngine.Reason;

class PromoEngineTest {

    private static final Instant NOW = Instant.parse("2026-10-15T05:00:00Z");
    private static final UUID A = UUID.randomUUID();
    private static final UUID B = UUID.randomUUID();

    private static Promotion promo(PromotionType type, String value, String min, String max) {
        Promotion p = new Promotion();
        p.setId(UUID.randomUUID());
        p.setCode("CODE");
        p.setName("test");
        p.setType(type);
        p.setValue(new BigDecimal(value));
        p.setMinSpend(min == null ? null : new BigDecimal(min));
        p.setMaxDiscount(max == null ? null : new BigDecimal(max));
        p.setScope(PromotionScope.ALL);
        p.setStartsAt(NOW.minus(1, ChronoUnit.DAYS));
        p.setEndsAt(NOW.plus(1, ChronoUnit.DAYS));
        return p;
    }

    private static PromoLine line(UUID shop, String total) {
        return new PromoLine(shop, UUID.randomUUID(), "slug", "cafe", null, new BigDecimal(total));
    }

    @Test
    void percent_is_capped_and_split_across_shops_to_the_cent() {
        // WATERFEST: 10% up to $5 on $30 + $13.33 → 4.33, split 3.00 / 1.33
        PromoEngine.Result r = PromoEngine.evaluate(promo(PromotionType.PERCENT, "10", null, "5"),
                List.of(line(A, "30"), line(B, "13.33")), NOW);
        assertThat(r.applied()).isTrue();
        assertThat(r.discount()).isEqualByComparingTo("4.33");
        assertThat(r.shareOf(A).add(r.shareOf(B))).isEqualByComparingTo("4.33");
        assertThat(r.shareOf(A)).isEqualByComparingTo("3.00");
        PromoEngine.Result capped = PromoEngine.evaluate(promo(PromotionType.PERCENT, "10", null, "5"),
                List.of(line(A, "80")), NOW);
        assertThat(capped.discount()).isEqualByComparingTo("5");
    }

    @Test
    void fixed_needs_its_minimum_and_never_exceeds_the_total() {
        Promotion new5 = promo(PromotionType.FIXED, "5", "20", null);
        PromoEngine.Result low = PromoEngine.evaluate(new5, List.of(line(A, "19.99")), NOW);
        assertThat(low.applied()).isFalse();
        assertThat(low.reason()).isEqualTo(Reason.MIN_SPEND);
        assertThat(low.shortBy()).isEqualByComparingTo("0.01");
        assertThat(PromoEngine.evaluate(new5, List.of(line(A, "20")), NOW).discount()).isEqualByComparingTo("5");
        assertThat(PromoEngine.evaluate(promo(PromotionType.FIXED, "5", null, null), List.of(line(A, "3")), NOW)
                .discount()).isEqualByComparingTo("3");
    }

    @Test
    void window_usage_and_unknown() {
        Promotion p = promo(PromotionType.FIXED, "5", null, null);
        p.setEndsAt(NOW);
        assertThat(PromoEngine.evaluate(p, List.of(line(A, "30")), NOW).reason()).isEqualTo(Reason.ENDED);
        // Up to the last moment before its end, it still applies: nobody has to end it by hand.
        p.setEndsAt(NOW.plusMillis(1));
        assertThat(PromoEngine.evaluate(p, List.of(line(A, "30")), NOW).applied()).isTrue();
        p = promo(PromotionType.FIXED, "5", null, null);
        p.setStartsAt(NOW.plusSeconds(60));
        assertThat(PromoEngine.evaluate(p, List.of(line(A, "30")), NOW).reason()).isEqualTo(Reason.SCHEDULED);
        p = promo(PromotionType.FIXED, "5", null, null);
        p.setUsageLimit(3);
        p.setUses(3);
        assertThat(PromoEngine.evaluate(p, List.of(line(A, "30")), NOW).reason()).isEqualTo(Reason.USED_UP);
        assertThat(PromoEngine.evaluate(null, List.of(line(A, "30")), NOW).reason()).isEqualTo(Reason.UNKNOWN);
    }

    @Test
    void a_shop_code_covers_only_that_shop_and_free_shipping_waives_fees() {
        Promotion shopCode = promo(PromotionType.PERCENT, "50", null, null);
        shopCode.setBusinessId(B);
        PromoEngine.Result r = PromoEngine.evaluate(shopCode, List.of(line(A, "10"), line(B, "4")), NOW);
        assertThat(r.discount()).isEqualByComparingTo("2");
        assertThat(r.shareOf(A)).isEqualByComparingTo("0");
        assertThat(r.shareOf(B)).isEqualByComparingTo("2");

        Promotion ship = promo(PromotionType.FREE_SHIPPING, "0", "15", null);
        assertThat(PromoEngine.evaluate(ship, List.of(line(A, "10")), NOW).applied()).isFalse();
        PromoEngine.Result free = PromoEngine.evaluate(ship, List.of(line(A, "10"), line(B, "6")), NOW);
        assertThat(free.applied()).isTrue();
        assertThat(free.discount()).isEqualByComparingTo("0");
        assertThat(free.freeShippingShops()).containsExactly(A, B);

        Promotion cat = promo(PromotionType.FIXED, "1", null, null);
        cat.setScope(PromotionScope.CATEGORY);
        cat.setTargetIds(List.of("fashion"));
        assertThat(PromoEngine.evaluate(cat, List.of(line(A, "10")), NOW).reason()).isEqualTo(Reason.NOT_APPLICABLE);
    }
}
