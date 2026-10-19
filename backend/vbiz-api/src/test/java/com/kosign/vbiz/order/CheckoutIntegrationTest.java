package com.kosign.vbiz.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.order.scheduler.OrderJobs;
import com.kosign.vbiz.payment.khqr.KhqrBuilder;

class CheckoutIntegrationTest extends OrderTestSupport {

    @Autowired
    OrderJobs jobs;

    @Test
    void quote_is_public_and_prices_like_the_client() throws Exception {
        // Rice: list 7.50, pays 6.75 ×2 = 13.50 (discount 1.50); Fresh Mart delivers to BKK1 for 0.75.
        Map<String, Object> body = new HashMap<>(Map.of("lines", List.of(line(RICE, 2)), "district", "BKK1"));
        JsonNode q = body(mvc.perform(postJson("/api/checkout/quote", body)).andExpect(status().isOk()).andReturn())
                .path("data");
        assertThat(q.path("subtotal").decimalValue()).isEqualByComparingTo("15.00");
        assertThat(q.path("discount").decimalValue()).isEqualByComparingTo("1.50");
        assertThat(q.path("deliveryFee").decimalValue()).isEqualByComparingTo("0.75");
        assertThat(q.path("total").decimalValue()).isEqualByComparingTo("14.25");
        JsonNode shop = q.path("shops").get(0);
        assertThat(shop.path("shopSlug").asText()).isEqualTo("fresh-mart");
        assertThat(shop.path("toFreeDelivery").decimalValue()).isEqualByComparingTo("11.50");
        assertThat(shop.path("lines").get(0).path("productSlug").asText()).isEqualTo("rice");

        // Unknown code, a code below its minimum, missing stock: reported, not refused.
        body.put("promoCode", "nope");
        assertThat(body(mvc.perform(postJson("/api/checkout/quote", body)).andReturn())
                .path("data").path("promo").path("reason").asText()).isEqualTo("UNKNOWN");
        body.put("promoCode", "new5");
        JsonNode p = body(mvc.perform(postJson("/api/checkout/quote", body)).andReturn()).path("data").path("promo");
        assertThat(p.path("applied").asBoolean()).isFalse();
        assertThat(p.path("reason").asText()).isEqualTo("MIN_SPEND");
        assertThat(p.path("shortBy").decimalValue()).isEqualByComparingTo("6.50");
        JsonNode out = body(mvc.perform(postJson("/api/checkout/quote", Map.of("lines",
                List.of(line(CASE_STORM, 1))))).andReturn()).path("data");
        assertThat(out.path("problems").get(0).path("code").asText()).isEqualTo("INSUFFICIENT_STOCK");
        // An address id needs a token.
        assertThat(body(mvc.perform(postJson("/api/checkout/quote", Map.of("lines", List.of(line(RICE, 1)),
                "addressId", UUID.randomUUID().toString()))).andReturn()).path("status").path("code").asText())
                .isEqualTo("UNAUTHORIZED");
    }

    @Test
    void two_shops_and_a_promo_make_two_orders_that_add_up_and_take_stock() throws Exception {
        Customer c = newCustomer("Toul Kork");
        int rice = stockOf(RICE);
        int cable = stockOf(CABLE);
        // Fresh Mart rice 4 × 6.75 = 27 (free delivery over 25); Nita cable 2 × 6 = 12 + 1.50 Toul Kork fee.
        Map<String, Object> body = checkout(c.addressId(), "CASH", List.of(line(RICE, 4), line(CABLE, 2)));
        body.put("promoCode", "waterfest");
        body.put("note", "Call on arrival");
        JsonNode quote = body(mvc.perform(postJson("/api/checkout/quote", body).header("Authorization", c.bearer()))
                .andReturn()).path("data");
        JsonNode r = place(c, body).path("data");
        JsonNode orders = r.path("orders");
        assertThat(orders.size()).isEqualTo(2);
        assertThat(r.path("payment").isMissingNode() || r.path("payment").isNull()).isTrue();
        BigDecimal sum = BigDecimal.ZERO;
        BigDecimal promo = BigDecimal.ZERO;
        for (JsonNode o : orders) {
            assertThat(o.path("number").asText()).matches("VB-\\d{5,}");
            assertThat(o.path("promoCode").asText()).isEqualTo("WATERFEST");
            assertThat(o.path("payment").path("channel").asText()).isEqualTo("COD");
            assertThat(o.path("payment").path("status").asText()).isEqualTo("PENDING");
            assertThat(o.path("note").asText()).isEqualTo("Call on arrival");
            sum = sum.add(o.path("total").decimalValue());
            promo = promo.add(o.path("promoDiscount").decimalValue());
        }
        // 10% of (27 + 12) = 3.90, split 2.70 / 1.20; Nita's automatic "$3 off accessories over $12"
        // (Phase 5) adds 3.00 to its order.
        assertThat(promo).isEqualByComparingTo("6.90");
        assertThat(sum).isEqualByComparingTo(quote.path("total").decimalValue());
        assertThat(sum).isEqualByComparingTo("33.60");
        JsonNode nitaQuote = quote.path("shops").get(1);
        assertThat(nitaQuote.path("autoPromo").path("name").asText()).isEqualTo("Accessories: buy any case, $3 off");
        assertThat(nitaQuote.path("autoPromo").path("amount").decimalValue()).isEqualByComparingTo("3.00");
        JsonNode fresh = orders.get(0);
        assertThat(fresh.path("shop").path("slug").asText()).isEqualTo("fresh-mart");
        assertThat(fresh.path("deliveryFee").decimalValue()).isEqualByComparingTo("0");
        // Fresh Mart auto-accepts; Nita does not.
        assertThat(fresh.path("status").asText()).isEqualTo("ACCEPTED");
        assertThat(orders.get(1).path("status").asText()).isEqualTo("NEW");
        assertThat(orders.get(1).path("canCancel").asBoolean()).isTrue();
        assertThat(stockOf(RICE)).isEqualTo(rice - 4);
        assertThat(stockOf(CABLE)).isEqualTo(cable - 2);
        assertThat(jdbc.queryForObject("""
                select count(*) from stock_movement where reason = 'ORDER_SALE' and note = ? and by_user_id is null""",
                Integer.class, orders.get(1).path("number").asText())).isEqualTo(1);
        assertThat(movementSumMismatches()).isZero();
        // The customer's list has both; the shop's inbox has the new order.
        JsonNode mine = customerGet(c, "/api/me/orders").path("data");
        assertThat(mine.size()).isEqualTo(2);
        Session nita = login(NITA, DEMO_PASSWORD);
        JsonNode inbox = seller(nita, "GET", "/api/notifications", null).path("data");
        assertThat(inbox.get(0).path("kind").asText()).isEqualTo("NEW_ORDER");
        assertThat(inbox.get(0).path("params").path("number").asText()).isEqualTo(orders.get(1).path("number").asText());
    }

    @Test
    void short_stock_is_refused_per_line_and_nothing_is_taken() throws Exception {
        Customer c = newCustomer("BKK1");
        int rice = stockOf(RICE);
        int croissant = stockOf(CROISSANT);
        JsonNode r = place(c, checkout(c.addressId(), "CASH",
                List.of(line(RICE, 1), line(CASE_STORM, 2), line(CROISSANT, croissant + 1))));
        assertThat(r.path("status").path("code").asText()).isEqualTo("INSUFFICIENT_STOCK");
        JsonNode details = r.path("error").path("details");
        assertThat(details.size()).isEqualTo(2);
        assertThat(details.get(0).path("field").asText()).isIn("lines[1]", "lines[2]");
        assertThat(details.findValuesAsText("field")).containsExactlyInAnyOrder("lines[1]", "lines[2]");
        assertThat(details.findValues("meta").stream().map(m -> m.path("stock").asInt()).toList())
                .containsExactlyInAnyOrder(0, croissant);
        assertThat(stockOf(RICE)).isEqualTo(rice);
        assertThat(customerGet(c, "/api/me/orders").path("data").size()).isZero();
    }

    @Test
    void validation_promo_and_idempotency() throws Exception {
        Customer c = newCustomer("BKK1");
        Map<String, Object> noAddr = checkout(null, "CASH", List.of(line(RICE, 1)));
        noAddr.remove("addressId");
        assertThat(place(c, noAddr).path("error").path("details").get(0).path("field").asText()).isEqualTo("addressId");
        Map<String, Object> badWindow = checkout(c.addressId(), "CASH", List.of(line(RICE, 1)));
        badWindow.put("window", "07:00–08:00");
        assertThat(place(c, badWindow).path("error").path("details").get(0).path("field").asText()).isEqualTo("window");
        Map<String, Object> small = checkout(c.addressId(), "CASH", List.of(line(RICE, 1)));
        small.put("promoCode", "NEW5");
        JsonNode bad = place(c, small);
        assertThat(bad.path("status").path("code").asText()).isEqualTo("PROMO_INVALID");
        assertThat(bad.path("error").path("details").get(0).path("meta").path("reason").asText()).isEqualTo("MIN_SPEND");
        mvc.perform(post("/api/checkout").header("Authorization", c.bearer()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(checkout(c.addressId(), "CASH", List.of(line(RICE, 1))))))
                .andExpect(status().isUnprocessableEntity());

        String key = "key-" + UUID.randomUUID();
        int rice = stockOf(RICE);
        JsonNode first = place(c, checkout(c.addressId(), "CARD", List.of(line(RICE, 1))), key).path("data");
        JsonNode again = place(c, checkout(c.addressId(), "CARD", List.of(line(RICE, 1))), key).path("data");
        assertThat(again.path("orders").get(0).path("number").asText())
                .isEqualTo(first.path("orders").get(0).path("number").asText());
        assertThat(stockOf(RICE)).isEqualTo(rice - 1);
        assertThat(first.path("payment").path("status").asText()).isEqualTo("PAID");
        assertThat(first.path("orders").get(0).path("payment").path("paid").asBoolean()).isTrue();
        assertThat(place(c, checkout(c.addressId(), "CARD", List.of(line(RICE, 2))), key)
                .path("status").path("code").asText()).isEqualTo("IDEMPOTENCY_CONFLICT");
    }

    @Test
    void khqr_waits_for_payment_then_places_the_orders() throws Exception {
        Customer c = newCustomer("BKK1");
        Session nita = login(NITA, DEMO_PASSWORD);
        int cable = stockOf(CABLE);
        JsonNode r = place(c, checkout(c.addressId(), "KHQR", List.of(line(CABLE, 1)))).path("data");
        JsonNode pay = r.path("payment");
        String number = r.path("orders").get(0).path("number").asText();
        assertThat(pay.path("status").asText()).isEqualTo("PENDING");
        assertThat(KhqrBuilder.crcValid(pay.path("khqr").asText())).isTrue();
        assertThat(pay.path("khqr").asText()).contains(number);
        assertThat(pay.path("orderNumbers").get(0).asText()).isEqualTo(number);
        assertThat(stockOf(CABLE)).isEqualTo(cable - 1);
        // Not placed yet: the shop does not see it, the customer's list leaves it out.
        assertThat(seller(nita, "GET", "/api/orders/" + number, null).path("status").path("code").asText())
                .isEqualTo("ORDER_NOT_FOUND");
        assertThat(customerGet(c, "/api/me/orders").path("data").size()).isZero();

        JsonNode paid = customerPost(c, "/api/me/payments/" + pay.path("id").asText() + "/simulate", null).path("data");
        assertThat(paid.path("status").asText()).isEqualTo("PAID");
        JsonNode o = customerGet(c, "/api/me/orders/" + number).path("data");
        assertThat(o.path("placedAt").isTextual()).isTrue();
        assertThat(o.path("payment").path("status").asText()).isEqualTo("PAID");
        assertThat(seller(nita, "GET", "/api/orders/" + number, null).path("data").path("status").asText())
                .isEqualTo("NEW");
        assertThat(customerPost(c, "/api/me/payments/" + pay.path("id").asText() + "/simulate", null)
                .path("status").path("code").asText()).isEqualTo("INVALID_STATUS_TRANSITION");
    }

    @Test
    void a_cancelled_or_expired_khqr_cancels_its_orders_and_restocks() throws Exception {
        Customer c = newCustomer("BKK1");
        int cable = stockOf(CABLE);
        JsonNode r = place(c, checkout(c.addressId(), "KHQR", List.of(line(CABLE, 2)))).path("data");
        JsonNode cancelled = customerPost(c, "/api/me/payments/" + r.path("payment").path("id").asText() + "/cancel",
                null).path("data");
        assertThat(cancelled.path("status").asText()).isEqualTo("CANCELLED");
        JsonNode o = customerGet(c, "/api/me/orders/" + r.path("orders").get(0).path("number").asText()).path("data");
        assertThat(o.path("status").asText()).isEqualTo("CANCELLED");
        assertThat(o.path("cancelReason").asText()).isEqualTo("paymentCancelled");
        assertThat(stockOf(CABLE)).isEqualTo(cable);

        JsonNode r2 = place(c, checkout(c.addressId(), "KHQR", List.of(line(CABLE, 1)))).path("data");
        Instant expires = Instant.parse(r2.path("payment").path("expiresAt").asText());
        assertThat(jobs.run(expires.plusSeconds(1)).expiredPayments()).isGreaterThanOrEqualTo(1);
        JsonNode o2 = customerGet(c, "/api/me/orders/" + r2.path("orders").get(0).path("number").asText()).path("data");
        assertThat(o2.path("status").asText()).isEqualTo("CANCELLED");
        assertThat(o2.path("cancelReason").asText()).isEqualTo("paymentExpired");
        assertThat(o2.path("payment").path("status").asText()).isEqualTo("EXPIRED");
        assertThat(stockOf(CABLE)).isEqualTo(cable);
        assertThat(movementSumMismatches()).isZero();
    }
}
