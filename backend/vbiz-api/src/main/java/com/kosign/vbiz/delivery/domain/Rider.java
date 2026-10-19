package com.kosign.vbiz.delivery.domain;

/** The VirtualBiz rider carrying an order ({@code orders.rider} JSONB). */
public record Rider(String name, String vehicle, String plate) {
}
