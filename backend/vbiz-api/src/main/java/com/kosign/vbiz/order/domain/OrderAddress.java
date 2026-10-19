package com.kosign.vbiz.order.domain;

import java.math.BigDecimal;

/** The delivery address as it was at checkout ({@code orders.address} JSONB). */
public record OrderAddress(String label, String name, String phone, String line, String district, String note,
        BigDecimal lat, BigDecimal lng) {
}
