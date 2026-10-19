package com.kosign.vbiz.pos;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.order.OrderTestSupport;

/** The Seller register (docs/api/phase5-pos-promotions-reviews.md § POS) at Nita Gadget Store. */
class PosIntegrationTest extends OrderTestSupport {

    @Test
    void shift_sale_retry_refund_and_close() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        JsonNode shift = seller(nita, "GET", "/api/pos/shift", null).path("data");
        assertThat(shift.path("floatUsd").decimalValue()).isEqualByComparingTo("50");
        assertThat(code(seller(nita, "POST", "/api/pos/shift", Map.of("floatUsd", 20, "floatKhr", 0))))
                .isEqualTo("SHIFT_ALREADY_OPEN");
        BigDecimal expected = shift.path("expectedUsd").decimalValue();
        assertThat(code(seller(nita, "POST", "/api/pos/shift/moves",
                Map.of("amount", expected.add(BigDecimal.ONE).negate(), "note", "bank")))).isEqualTo("VALIDATION_FAILED");
        JsonNode in = seller(nita, "POST", "/api/pos/shift/moves", Map.of("amount", 10, "note", "change")).path("data");
        assertThat(in.path("expectedUsd").decimalValue()).isEqualByComparingTo(expected.add(BigDecimal.TEN));
        assertThat(in.path("moves").get(in.path("moves").size() - 1).path("note").asText()).isEqualTo("change");

        topUp(nita, NITA_GADGET_ID, CABLE, 3);
        int stock = stockOf(CABLE);
        String ref = UUID.randomUUID().toString();
        Map<String, Object> sale = new LinkedHashMap<>();
        sale.put("clientRef", ref);
        sale.put("lines", List.of(Map.of("variantId", CABLE, "qty", 2, "unitPrice", 6)));
        sale.put("discount", 1);
        sale.put("discountReason", "loyal");
        sale.put("customerName", "Dara");
        sale.put("payments", List.of(Map.of("method", "CASH", "amount", 12)));
        assertThat(code(seller(nita, "POST", "/api/pos/sales", sale))).isEqualTo("VALIDATION_FAILED");
        sale.put("payments", List.of(Map.of("method", "CASH", "amount", 6), Map.of("method", "KHQR", "amount", 5)));
        sale.put("cash", Map.of("usd", 10, "khr", 0, "change", 4));
        JsonNode r = seller(nita, "POST", "/api/pos/sales", sale).path("data");
        assertThat(r.path("number").asText()).matches("R-\\d{5,}");
        assertThat(r.path("clientRef").asText()).isEqualTo(ref);
        assertThat(r.path("total").decimalValue()).isEqualByComparingTo("11");
        assertThat(r.path("lines").get(0).path("title").asText()).isEqualTo("USB-C to USB-C Cable 1 m");
        assertThat(stockOf(CABLE)).isEqualTo(stock - 2);
        // The offline queue sending it again stores nothing new.
        JsonNode again = seller(nita, "POST", "/api/pos/sales", sale).path("data");
        assertThat(again.path("number").asText()).isEqualTo(r.path("number").asText());
        assertThat(stockOf(CABLE)).isEqualTo(stock - 2);
        // Cash in the drawer: + 6 (the KHQR part is not cash).
        assertThat(seller(nita, "GET", "/api/pos/shift", null).path("data").path("expectedUsd").decimalValue())
                .isEqualByComparingTo(expected.add(BigDecimal.valueOf(16)));

        // Refund one cable back to the shelf; no more than was sold.
        JsonNode refunded = seller(nita, "POST", "/api/pos/sales/" + r.path("number").asText() + "/refunds",
                Map.of("lines", List.of(Map.of("variantId", CABLE, "qty", 1)), "amount", 5.5, "method", "CASH",
                        "restock", true)).path("data");
        assertThat(refunded.path("refunds")).hasSize(1);
        assertThat(stockOf(CABLE)).isEqualTo(stock - 1);
        assertThat(code(seller(nita, "POST", "/api/pos/sales/" + r.path("number").asText() + "/refunds",
                Map.of("lines", List.of(Map.of("variantId", CABLE, "qty", 2)), "amount", 1, "method", "CASH",
                        "restock", false)))).isEqualTo("VALIDATION_FAILED");
        assertThat(code(seller(nita, "POST", "/api/pos/sales/" + r.path("number").asText() + "/refunds",
                Map.of("lines", List.of(Map.of("variantId", CABLE, "qty", 1)), "amount", 6, "method", "CASH",
                        "restock", false)))).isEqualTo("VALIDATION_FAILED");
        assertThat(seller(nita, "GET", "/api/pos/sales", null).path("data").toString())
                .contains(r.path("number").asText());

        // Close with $1 short; the register then needs a new shift.
        BigDecimal now = seller(nita, "GET", "/api/pos/shift", null).path("data").path("expectedUsd").decimalValue();
        JsonNode closed = seller(nita, "POST", "/api/pos/shift/close", Map.of("countedUsd", now.subtract(BigDecimal.ONE)))
                .path("data");
        assertThat(closed.path("difference").decimalValue()).isEqualByComparingTo("-1");
        JsonNode none = seller(nita, "GET", "/api/pos/shift", null).path("data");
        assertThat(none.isMissingNode() || none.isNull()).isTrue();
        sale.put("clientRef", UUID.randomUUID().toString());
        assertThat(code(seller(nita, "POST", "/api/pos/sales", sale))).isEqualTo("SHIFT_NOT_FOUND");
        assertThat(seller(nita, "GET", "/api/pos/shifts", null).path("data").get(0).path("id").asText())
                .isEqualTo(closed.path("id").asText());
        JsonNode opened = seller(nita, "POST", "/api/pos/shift", Map.of("floatUsd", 50, "floatKhr", 20000)).path("data");
        assertThat(opened.path("floatKhr").asLong()).isEqualTo(20000);

        // Counter stock is the server's own.
        assertThat(code(seller(nita, "POST", "/api/inventory/movements",
                Map.of("variantId", CABLE, "delta", -1, "reason", "POS_SALE")))).isEqualTo("VALIDATION_FAILED");
        assertThat(movementSumMismatches()).isZero();
    }

    @Test
    void cannot_oversell_and_a_service_shop_has_no_register() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        Map<String, Object> sale = new LinkedHashMap<>();
        sale.put("clientRef", UUID.randomUUID().toString());
        sale.put("lines", List.of(Map.of("variantId", CASE_STORM, "qty", 1, "unitPrice", 12)));
        sale.put("discount", 0);
        sale.put("payments", List.of(Map.of("method", "CARD", "amount", 12)));
        JsonNode r = seller(nita, "POST", "/api/pos/sales", sale);
        assertThat(code(r)).isIn("INSUFFICIENT_STOCK", "SHIFT_NOT_FOUND");
        Session dana = login(DANA, DEMO_PASSWORD);
        assertThat(code(body(mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .get("/api/pos/shift").header("Authorization", dana.bearer()).header("X-Business-Id", GLOW_BEAUTY_ID))
                .andReturn()))).isEqualTo("WRONG_BUSINESS_TYPE");
    }

    private static String code(JsonNode r) {
        return r.path("status").path("code").asText();
    }
}
