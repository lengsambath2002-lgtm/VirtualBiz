package com.kosign.vbiz.admin.service;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * {@code vbiz.payouts.*}. A paid online payment is released to the shop this long after its order
 * was delivered or picked up: the landing page promises payouts the next business day. A return
 * after that is taken back from the shop's next payout.
 */
@ConfigurationProperties("vbiz.payouts")
public record PayoutProperties(@DefaultValue("P1D") Duration releaseAfter) {
}
