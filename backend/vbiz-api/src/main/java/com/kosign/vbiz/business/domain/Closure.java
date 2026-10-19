package com.kosign.vbiz.business.domain;

/** A day the business is closed: {@code date} is {@code YYYY-MM-DD} in Asia/Phnom_Penh. */
public record Closure(String date, String reason) {
}
