package com.kosign.vbiz.pos.payload;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import com.kosign.vbiz.payment.domain.PaymentMethod;

/**
 * {@code GET /api/receipts/{token}} (public): a shared sale receipt as the customer sees it, with
 * the shop's receipt text and VAT from its policy.
 */
public record ReceiptView(
        String number,
        Instant at,
        Shop shop,
        List<Line> lines,
        BigDecimal subtotal,
        BigDecimal discount,
        BigDecimal tip,
        BigDecimal total,
        List<Payment> payments,
        BigDecimal refunded,
        String customerName,
        String cashier) {

    public record Shop(String name, String logoUrl, String phone, String address, String receiptHeader,
            String receiptFooter, BigDecimal taxPct, String taxId) {
    }

    public record Line(String title, String variantName, int qty, BigDecimal unitPrice) {
    }

    public record Payment(PaymentMethod method, BigDecimal amount) {
    }
}
