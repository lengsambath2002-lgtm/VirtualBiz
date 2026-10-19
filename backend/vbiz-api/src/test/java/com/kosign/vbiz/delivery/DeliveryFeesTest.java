package com.kosign.vbiz.delivery;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.kosign.vbiz.business.domain.ProductSettings;
import com.kosign.vbiz.delivery.service.DeliveryFees;
import com.kosign.vbiz.order.domain.FulfilmentMethod;

/** Mirrors frontend/src/lib/pricing/pricing.test.ts § deliveryFee. */
class DeliveryFeesTest {

    private static final ProductSettings S = new ProductSettings(false, 20, 5, true, true, new BigDecimal("25"),
            ProductSettings.DEFAULT_ZONES);

    private static BigDecimal fee(String district, String subtotal, FulfilmentMethod m) {
        return DeliveryFees.fee(S, district, new BigDecimal(subtotal), m);
    }

    @Test
    void zone_fee_free_over_and_pickup() {
        assertThat(fee("BKK1", "10", FulfilmentMethod.DELIVERY)).isEqualByComparingTo("0.75");
        assertThat(fee("Toul Kork", "10", FulfilmentMethod.DELIVERY)).isEqualByComparingTo("1.50");
        assertThat(fee("Mean Chey", "10", FulfilmentMethod.DELIVERY)).isEqualByComparingTo("2.50");
        assertThat(fee("Nowhere", "10", FulfilmentMethod.DELIVERY)).isEqualByComparingTo("2.50");
        assertThat(fee(null, "10", FulfilmentMethod.DELIVERY)).isEqualByComparingTo("2.50");
        assertThat(fee("Toul Kork", "25", FulfilmentMethod.DELIVERY)).isEqualByComparingTo("0");
        assertThat(fee("Toul Kork", "24.99", FulfilmentMethod.DELIVERY)).isEqualByComparingTo("1.50");
        assertThat(fee("Mean Chey", "1", FulfilmentMethod.PICKUP)).isEqualByComparingTo("0");
        assertThat(DeliveryFees.toFree(S, new BigDecimal("18.50"))).isEqualByComparingTo("6.50");
        assertThat(DeliveryFees.toFree(S, new BigDecimal("30"))).isEqualByComparingTo("0");
    }

    @Test
    void no_threshold_and_no_zones() {
        ProductSettings noFree = new ProductSettings(false, 20, 5, true, true, null, ProductSettings.DEFAULT_ZONES);
        assertThat(DeliveryFees.fee(noFree, "BKK1", new BigDecimal("999"), FulfilmentMethod.DELIVERY))
                .isEqualByComparingTo("0.75");
        ProductSettings none = new ProductSettings(false, 20, 5, true, true, null, List.of());
        assertThat(DeliveryFees.fee(none, "BKK1", BigDecimal.ONE, FulfilmentMethod.DELIVERY))
                .isEqualByComparingTo("0");
    }
}
