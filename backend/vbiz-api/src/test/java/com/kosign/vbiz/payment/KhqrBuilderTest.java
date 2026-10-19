package com.kosign.vbiz.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.kosign.vbiz.payment.khqr.KhqrBuilder;

class KhqrBuilderTest {

    private static final Instant T0 = Instant.parse("2026-10-15T03:00:00Z");

    private static KhqrBuilder.Request req(String amount) {
        return new KhqrBuilder.Request("virtualbiz@aclb", "VirtualBiz", "Phnom Penh", KhqrBuilder.USD,
                new BigDecimal(amount), "VB-24039", "VirtualBiz", "Online", T0, T0.plusSeconds(180));
    }

    @Test
    void crc16_ccitt_false_matches_the_reference_check_value() {
        // CRC-16/CCITT-FALSE check value for "123456789".
        assertThat(KhqrBuilder.crc16("123456789")).isEqualTo("29B1");
    }

    @Test
    void builds_a_dynamic_usd_khqr_with_a_valid_checksum() {
        String qr = KhqrBuilder.build(req("12.5"));
        assertThat(qr).startsWith("000201" + "010212");
        assertThat(qr).contains("2919" + "0015virtualbiz@aclb");
        assertThat(qr).contains("52045999").contains("5303840").contains("540512.50").contains("5802KH")
                .contains("5910VirtualBiz").contains("6010Phnom Penh");
        assertThat(qr).contains("0108VB-24039");
        assertThat(qr).contains("0013" + T0.toEpochMilli()).contains("0113" + T0.plusSeconds(180).toEpochMilli());
        assertThat(qr.substring(qr.length() - 8, qr.length() - 4)).isEqualTo("6304");
        assertThat(KhqrBuilder.crcValid(qr)).isTrue();
        assertThat(KhqrBuilder.crcValid(qr.replace("12.50", "12.51"))).isFalse();
        assertThat(KhqrBuilder.md5(qr)).hasSize(32);
    }

    @Test
    void refuses_a_zero_amount() {
        assertThatThrownBy(() -> KhqrBuilder.build(req("0"))).isInstanceOf(IllegalArgumentException.class);
    }
}
