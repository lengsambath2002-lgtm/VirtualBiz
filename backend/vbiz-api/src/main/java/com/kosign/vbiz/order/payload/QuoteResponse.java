package com.kosign.vbiz.order.payload;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/** {@code Quote}: server-side totals of a checkout (docs/api/phase3-orders-checkout.md § Checkout). */
public record QuoteResponse(String method, String district, int count, BigDecimal subtotal, BigDecimal discount,
        BigDecimal promoDiscount, BigDecimal deliveryFee, BigDecimal total, List<Shop> shops, Promo promo,
        List<Problem> problems) {

    public record Shop(String businessId, String shopSlug, String shopName, List<Line> lines, BigDecimal subtotal,
            BigDecimal discount, BigDecimal promoDiscount, BigDecimal deliveryFee, boolean deliveryWaived,
            BigDecimal freeDeliveryOver, BigDecimal toFreeDelivery, BigDecimal total, boolean pickup, boolean cod,
            AutoPromo autoPromo) {
    }

    /** The shop's automatic promotion in this quote (its discount is part of the shop's promoDiscount). */
    public record AutoPromo(String id, String name, BigDecimal amount, boolean freeShipping) {
    }

    public record Line(String variantId, String productId, String productSlug, String title, String variantName,
            Map<String, String> options, int qty, BigDecimal listPrice, BigDecimal unitPrice, BigDecimal lineTotal,
            int stock) {
    }

    public record Promo(String code, String name, String type, BigDecimal value, BigDecimal minSpend,
            BigDecimal maxDiscount, String businessId, boolean applied, String reason, BigDecimal shortBy) {
    }

    public record Problem(String field, String code, String variantId, Integer stock) {
    }
}
