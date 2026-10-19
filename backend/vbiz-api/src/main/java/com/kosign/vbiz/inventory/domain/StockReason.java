package com.kosign.vbiz.inventory.domain;

/** Reason on every stock movement. Online orders and POS write through the same log. */
public enum StockReason {
    RECEIVED,
    COUNT_CORRECTION,
    DAMAGED_LOST,
    CUSTOMER_RETURN,
    ORDER_CANCELLED,
    ORDER_SALE,
    POS_SALE,
    POS_REFUND,
    QUICK_ADJUST,
    OPENING_STOCK,
    MARKED_SOLD_OUT
}
