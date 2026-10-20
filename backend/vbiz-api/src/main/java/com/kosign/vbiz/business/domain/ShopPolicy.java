package com.kosign.vbiz.business.domain;

import java.math.BigDecimal;

/**
 * A shop's own rules and contact links, for both business types (stored as JSONB; a null field
 * means the default). Prices are VAT-inclusive, as Cambodian retail quotes them: {@code taxPct}
 * only shows the VAT inside a total on receipts. {@code payCash / payKhqr / payCard}: what the
 * counter (POS, service checkout) accepts.
 */
public record ShopPolicy(
        String receiptHeader,
        String receiptFooter,
        BigDecimal taxPct,
        String taxId,
        Boolean payCash,
        Boolean payKhqr,
        Boolean payCard,
        String facebook,
        String telegram,
        String instagram,
        String tiktok,
        String website) {

    public static ShopPolicy defaults() {
        return new ShopPolicy(null, null, BigDecimal.ZERO, null, true, true, true, null, null, null, null, null);
    }

    /** {@code p} with every missing field taken from the defaults. */
    public static ShopPolicy of(ShopPolicy p) {
        ShopPolicy d = defaults();
        if (p == null) {
            return d;
        }
        return new ShopPolicy(p.receiptHeader(), p.receiptFooter(), p.taxPct() == null ? d.taxPct() : p.taxPct(),
                p.taxId(), p.payCash() == null ? d.payCash() : p.payCash(),
                p.payKhqr() == null ? d.payKhqr() : p.payKhqr(), p.payCard() == null ? d.payCard() : p.payCard(),
                p.facebook(), p.telegram(), p.instagram(), p.tiktok(), p.website());
    }

    /** Whether the counter takes this method ({@code CASH}, {@code KHQR} or {@code CARD}). */
    public boolean accepts(String method) {
        return switch (method) {
            case "CASH" -> !Boolean.FALSE.equals(payCash);
            case "KHQR" -> !Boolean.FALSE.equals(payKhqr);
            case "CARD" -> !Boolean.FALSE.equals(payCard);
            default -> true;
        };
    }
}
