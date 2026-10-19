package com.kosign.vbiz.common.helper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

class MoneyTest {

    @Test
    void usd_scales_to_two_places_half_up() {
        assertThat(Money.usd(new BigDecimal("12.345"))).isEqualByComparingTo("12.35").hasToString("12.35");
        assertThat(Money.usd(new BigDecimal("12.344"))).hasToString("12.34");
        assertThat(Money.usd(new BigDecimal("7"))).hasToString("7.00");
        assertThat(Money.usd("  3.5 ")).hasToString("3.50");
        assertThat(Money.ofCents(1250)).hasToString("12.50");
    }

    @Test
    void usd_rejects_null_garbage_and_overflow() {
        assertThatThrownBy(() -> Money.usd((BigDecimal) null))
                .isInstanceOf(BusinessException.class)
                .extracting("statusCode").isEqualTo(StatusCode.INVALID_AMOUNT);
        assertThatThrownBy(() -> Money.usd("abc")).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> Money.usd("")).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> Money.usd(new BigDecimal("10000000000.00"))).isInstanceOf(BusinessException.class);
        assertThat(Money.usd(Money.MAX_USD)).isEqualByComparingTo(Money.MAX_USD);
    }

    @ParameterizedTest(name = "{0} USD -> {1} KHR")
    @CsvSource({
            "0.00, 0",
            "1.00, 4100",
            "2.50, 10300",   // 10,250 rounds half-up to 10,300
            "4.50, 18500",   // 18,450 -> 18,500
            "12.34, 50600",  // 50,594 -> 50,600
            "0.01, 0",       // 41 -> 0
            "0.02, 100",     // 82 -> 100
            "99.99, 410000", // 409,959 -> 410,000
            "-2.50, -10300"  // refunds round symmetrically
    })
    void toKhr_rounds_to_nearest_100_at_default_rate(String usd, long khr) {
        assertThat(Money.toKhr(new BigDecimal(usd))).isEqualTo(khr);
    }

    @Test
    void toKhr_uses_the_given_rate() {
        assertThat(Money.toKhr(new BigDecimal("1.00"), 4000)).isEqualTo(4000);
        assertThat(Money.toKhr(new BigDecimal("1.23"), 4050)).isEqualTo(5000); // 4,981.5 -> 5,000
        assertThatThrownBy(() -> Money.toKhr(BigDecimal.ONE, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Money.toKhr(null)).isInstanceOf(BusinessException.class);
    }

    @Test
    void percentOf_computes_commission() {
        assertThat(Money.percentOf(new BigDecimal("20.00"), new BigDecimal("5"))).hasToString("1.00");
        assertThat(Money.percentOf(new BigDecimal("12.99"), new BigDecimal("5"))).hasToString("0.65"); // 0.6495
    }
}
