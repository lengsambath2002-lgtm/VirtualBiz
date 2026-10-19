package com.kosign.vbiz.order.payload;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Seller home to-dos and the rail badge: open orders per step, and today's online sales. */
public record OrderCountsResponse(@JsonProperty("new") long newOrders, long pack, long ship, long out, BigDecimal todaySales,
        long todayOrders) {
}
