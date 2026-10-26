package com.kosign.vbiz.common.logging;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class LogMaskTest {

    @Test
    void hides_codes_and_shortens_addresses() {
        assertThat(LogMask.text("482913 is your VirtualBiz code")).isEqualTo("•••• is your VirtualBiz code");
        assertThat(LogMask.text("Order VB-77 placed")).isEqualTo("Order VB-77 placed");
        assertThat(LogMask.contact("dara@gmail.com")).isEqualTo("d***@gmail.com");
        assertThat(LogMask.contact("+85512345678")).isEqualTo("***678");
        assertThat(LogMask.contact(null)).isEqualTo("***");
    }
}
