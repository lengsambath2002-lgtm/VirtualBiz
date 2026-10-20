package com.kosign.vbiz.order.domain;

/** Where an order came from. Everything but {@code ONLINE} is a manual order the shop entered. */
public enum OrderSource {
    ONLINE,
    PHONE,
    FACEBOOK,
    TELEGRAM,
    WALK_IN,
    OTHER
}
