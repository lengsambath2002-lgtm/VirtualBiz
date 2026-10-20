package com.kosign.vbiz.common.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

class TotpTest {

    /** RFC 6238 Appendix B (SHA-1 seed "12345678901234567890"), last 6 of the 8-digit values. */
    private static final String RFC_SECRET = Totp.base32("12345678901234567890".getBytes(StandardCharsets.US_ASCII));

    @Test
    void matches_the_rfc_6238_test_vectors() {
        assertThat(RFC_SECRET).isEqualTo("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
        assertThat(Totp.code(RFC_SECRET, Totp.step(59))).isEqualTo("287082");
        assertThat(Totp.code(RFC_SECRET, Totp.step(1111111109))).isEqualTo("081804");
        assertThat(Totp.code(RFC_SECRET, Totp.step(1234567890))).isEqualTo("005924");
        assertThat(Totp.code(RFC_SECRET, Totp.step(2000000000))).isEqualTo("279037");
    }

    @Test
    void accepts_one_step_of_drift_either_way_and_reports_the_step() {
        long now = Totp.step(1234567890);
        assertThat(Totp.match(RFC_SECRET, Totp.code(RFC_SECRET, now - 1), now, 1)).isEqualTo(now - 1);
        assertThat(Totp.match(RFC_SECRET, Totp.code(RFC_SECRET, now + 1), now, 1)).isEqualTo(now + 1);
        assertThat(Totp.match(RFC_SECRET, Totp.code(RFC_SECRET, now + 2), now, 1)).isEqualTo(-1);
        assertThat(Totp.match(RFC_SECRET, "12345", now, 1)).isEqualTo(-1);
        assertThat(Totp.match(RFC_SECRET, null, now, 1)).isEqualTo(-1);
    }

    @Test
    void new_secrets_are_160_bit_base32_and_round_trip() {
        String s = Totp.newSecret();
        assertThat(s).hasSize(32).matches("[A-Z2-7]+");
        assertThat(Totp.unbase32(s)).hasSize(20);
        assertThat(Totp.uri("VirtualBiz", "a b@x.com", s))
                .isEqualTo("otpauth://totp/VirtualBiz:a%20b%40x.com?secret=" + s
                        + "&issuer=VirtualBiz&algorithm=SHA1&digits=6&period=30");
    }

    @Test
    void secret_box_seals_with_a_random_iv_and_rejects_a_wrong_key() {
        SecretBox box = new SecretBox("dGVzdC1vbmx5LWRhdGEta2V5LTAxMjM0NTY3ODlhYiE=");
        String a = box.seal("JBSWY3DPEHPK3PXP");
        assertThat(a).startsWith("v1:").isNotEqualTo(box.seal("JBSWY3DPEHPK3PXP"));
        assertThat(box.open(a)).isEqualTo("JBSWY3DPEHPK3PXP");
        SecretBox other = new SecretBox("b3RoZXIta2V5LW90aGVyLWtleS1vdGhlci1rZXkxMjM=");
        assertThatThrownBy(() -> other.open(a)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new SecretBox("")).isInstanceOf(IllegalStateException.class);
    }
}
