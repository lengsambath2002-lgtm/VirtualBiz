package com.kosign.vbiz.review;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.order.OrderTestSupport;

/** Promotions, customer reviews and the Seller's customer list (docs/api/phase5-pos-promotions-reviews.md). */
class SellerPhase5IntegrationTest extends OrderTestSupport {

    @Test
    void promotions_crud_end_and_undo() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        JsonNode list = seller(nita, "GET", "/api/promotions", null).path("data");
        assertThat(list.toString()).contains("NITAWATER").contains("Accessories: buy any case, $3 off");

        String start = java.time.Instant.now().minusSeconds(3600).toString();
        String end = java.time.Instant.now().plusSeconds(86400 * 7).toString();
        JsonNode p = seller(nita, "POST", "/api/promotions", Map.of("name", "Cable week", "type", "PERCENT",
                "value", 20, "code", "cable20", "scope", "PRODUCTS",
                "targetIds", List.of("aaaaaaaa-0000-4000-8000-000000000018"), "startsAt", start, "endsAt", end))
                .path("data");
        assertThat(p.path("code").asText()).isEqualTo("CABLE20");
        assertThat(p.path("state").asText()).isEqualTo("ACTIVE");
        // Codes are unique among the shop's and the platform's; targets must be the shop's.
        assertThat(seller(nita, "POST", "/api/promotions", Map.of("name", "Dup", "type", "FIXED", "value", 1,
                "code", "WATERFEST", "scope", "ALL", "startsAt", start, "endsAt", end)).path("error").path("details")
                .get(0).path("field").asText()).isEqualTo("code");
        assertThat(seller(nita, "POST", "/api/promotions", Map.of("name", "Bad", "type", "FIXED", "value", 1,
                "scope", "PRODUCTS", "targetIds", List.of("aaaaaaaa-0000-4000-8000-000000000001"), "startsAt", start,
                "endsAt", end)).path("error").path("details").get(0).path("field").asText()).isEqualTo("targetIds");

        String id = p.path("id").asText();
        JsonNode ended = seller(nita, "POST", "/api/promotions/" + id + "/end", null).path("data");
        assertThat(ended.path("promotion").path("state").asText()).isEqualTo("ENDED");
        JsonNode back = body(mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .patch("/api/promotions/" + id).header("Authorization", nita.bearer())
                .header("X-Business-Id", NITA_GADGET_ID).contentType("application/json")
                .content(json.writeValueAsString(Map.of("endsAt", ended.path("previousEndsAt").asText()))))
                .andReturn()).path("data");
        assertThat(back.path("state").asText()).isEqualTo("ACTIVE");
    }

    @Test
    void a_delivered_order_can_be_reviewed_once_and_rates_the_item() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        Customer c = newCustomer("BKK1");
        topUp(nita, NITA_GADGET_ID, CABLE, 2);
        JsonNode r = place(c, checkout(c.addressId(), "CASH", List.of(line(CABLE, 1)))).path("data");
        String no = r.path("orders").get(0).path("number").asText();
        String id = r.path("orders").get(0).path("id").asText();
        JsonNode early = customerPost(c, "/api/me/reviews", Map.of("order", no, "item", "nita-cable", "stars", 5));
        assertThat(early.path("error").path("details").get(0).path("field").asText()).isEqualTo("order");

        seller(nita, "POST", "/api/orders/accept", Map.of("ids", List.of(id)));
        seller(nita, "POST", "/api/orders/" + no + "/pack", null);
        seller(nita, "POST", "/api/orders/" + no + "/ship", Map.of("deliveryBy", "OWN_DELIVERY"));
        seller(nita, "POST", "/api/orders/" + no + "/deliver", null);

        assertThat(customerPost(c, "/api/me/reviews", Map.of("order", no, "item", "nita-iphone15", "stars", 5))
                .path("error").path("details").get(0).path("field").asText()).isEqualTo("item");
        JsonNode mine = customerPost(c, "/api/me/reviews", Map.of("order", no, "item", "nita-cable", "stars", 4,
                "tags", List.of("Fast delivery"), "text", "Works with my laptop.")).path("data");
        assertThat(mine.path("orderNumber").asText()).isEqualTo(no);
        assertThat(mine.path("itemType").asText()).isEqualTo("PRODUCT");
        assertThat(customerPost(c, "/api/me/reviews", Map.of("order", no, "item", "nita-cable", "stars", 1))
                .path("status").path("code").asText()).isEqualTo("CONFLICT");
        assertThat(customerGet(c, "/api/me/orders/" + no).path("data").path("reviewed").asBoolean()).isTrue();
        assertThat(customerGet(c, "/api/me/reviews").path("data").get(0).path("itemSlug").asText()).isEqualTo("nita-cable");

        // The shop sees it, hears about it, replies; the marketplace shows it.
        JsonNode reviews = seller(nita, "GET", "/api/reviews", null).path("data");
        JsonNode rv = null;
        for (JsonNode x : reviews) {
            if ("Works with my laptop.".equals(x.path("text").asText())) {
                rv = x;
            }
        }
        assertThat(rv).isNotNull();
        assertThat(rv.path("verified").asBoolean()).isTrue();
        assertThat(seller(nita, "GET", "/api/notifications", null).path("data").toString()).contains("NEW_REVIEW");
        assertThat(seller(nita, "POST", "/api/reviews/" + rv.path("id").asText() + "/reply", Map.of("text", "Thank you!"))
                .path("data").path("reply").asText()).isEqualTo("Thank you!");
        JsonNode pub = body(mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .get("/api/marketplace/items/nita-cable/reviews")).andReturn()).path("data");
        assertThat(pub.toString()).contains("Works with my laptop.");

        // The customer is now on the shop's customer list, with the delivery district.
        JsonNode clients = seller(nita, "GET", "/api/clients", null).path("data");
        boolean listed = false;
        for (JsonNode x : clients) {
            listed |= "BKK1".equals(x.path("district").asText()) && x.path("userId").asText()
                    .equals(c.session().user().path("id").asText());
        }
        assertThat(listed).isTrue();
    }

    @Test
    void the_seller_customer_list_was_back_filled_from_orders() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        JsonNode clients = seller(nita, "GET", "/api/clients", null).path("data");
        assertThat(clients.toString()).contains("Tena Heng").contains("Hay Kongmeng");
        for (JsonNode x : clients) {
            if ("Tena Heng".equals(x.path("name").asText())) {
                assertThat(x.path("district").asText()).isEqualTo("Toul Kork");
                assertThat(x.path("userId").asText()).isEqualTo("11111111-1111-4111-8111-000000000100");
            }
        }
    }

    @Test
    void a_completed_booking_can_be_reviewed() throws Exception {
        Session dana = login(DANA, DEMO_PASSWORD);
        Session c = signUp("Sok Dara", uniqueEmail("rv"), "Bright#2026");
        LocalDate day = LocalDate.now(ZoneId.of("Asia/Phnom_Penh")).plusDays(45);
        while (day.getDayOfWeek().getValue() > DayOfWeek.THURSDAY.getValue()) {
            day = day.plusDays(1);
        }
        JsonNode b = body(mvc.perform(postJson("/api/me/bookings", Map.of("service", "glow-cut", "staffId",
                "33333333-3333-4333-8333-000000000002", "date", day.toString(), "start", 600, "name", "Sok Dara",
                "phone", uniquePhone())).header("Authorization", c.bearer())).andReturn()).path("data");
        String number = b.path("number").asText();
        JsonNode early = body(mvc.perform(postJson("/api/me/reviews", Map.of("booking", number, "item", "glow-cut",
                "stars", 5)).header("Authorization", c.bearer())).andReturn());
        assertThat(early.path("error").path("details").get(0).path("field").asText()).isEqualTo("booking");
        for (String s : new String[] {"BOOKED", "ARRIVED"}) {
            mvc.perform(postJson("/api/appointments/" + number + "/status", Map.of("status", s))
                    .header("Authorization", dana.bearer()).header("X-Business-Id", GLOW_BEAUTY_ID));
        }
        mvc.perform(postJson("/api/sales", Map.of("appointmentId", b.path("id").asText(), "lines",
                List.of(Map.of("serviceId", "cccccccc-0000-4000-8000-000000000008", "title", "Haircut & Style", "qty", 1,
                        "unitPrice", 8)), "discount", 0, "tip", 0, "payments", List.of(Map.of("method", "CASH", "amount", 8))))
                .header("Authorization", dana.bearer()).header("X-Business-Id", GLOW_BEAUTY_ID));
        JsonNode rv = body(mvc.perform(postJson("/api/me/reviews", Map.of("booking", number, "item", "glow-cut",
                "stars", 5, "text", "Great cut")).header("Authorization", c.bearer())).andReturn()).path("data");
        assertThat(rv.path("bookingNumber").asText()).isEqualTo(number);
        assertThat(rv.path("itemType").asText()).isEqualTo("SERVICE");
    }
}
