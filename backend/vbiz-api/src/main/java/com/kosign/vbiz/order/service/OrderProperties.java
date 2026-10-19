package com.kosign.vbiz.order.service;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * {@code vbiz.orders.*}: order timing rules (defaults from {@code OrderStatus} and the prototype)
 * and the background job. {@code devEndpoints} exposes the local test hooks ({@code /api/dev/**}).
 */
@ConfigurationProperties("vbiz.orders")
public record OrderProperties(
        @DefaultValue("PT1H") Duration autoCancelAfter,
        @DefaultValue("PT5M") Duration customerCancelWindow,
        @DefaultValue("PT30S") Duration undoAcceptWindow,
        @DefaultValue("P7D") Duration returnWindow,
        @DefaultValue Jobs jobs,
        @DefaultValue("false") boolean devEndpoints) {

    public record Jobs(@DefaultValue("true") boolean enabled, @DefaultValue("PT1M") Duration interval) {
    }
}
