package com.kosign.vbiz.payment.service;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * {@code vbiz.payment.*}. The KHQR account is VirtualBiz's merchant Bakong account (it collects
 * online payments and pays shops out); confirming transfers needs Bakong API credentials, so only
 * the local simulator can mark a KHQR paid ({@code simulator.enabled}, local / dev / test).
 */
@ConfigurationProperties("vbiz.payment")
public record PaymentProperties(
        @DefaultValue Khqr khqr,
        @DefaultValue Simulator simulator) {

    public record Khqr(
            @DefaultValue("virtualbiz@aclb") String bakongId,
            @DefaultValue("VirtualBiz") String merchantName,
            @DefaultValue("Phnom Penh") String merchantCity,
            @DefaultValue("PT3M") Duration ttl) {
    }

    public record Simulator(@DefaultValue("false") boolean enabled) {
    }
}
