package com.kosign.vbiz.booking;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;

/** The Service Provider workspace against Glow Beauty Salon (docs/api/phase4-bookings-provider.md § Provider). */
class ProviderWorkspaceIntegrationTest extends BookingTestSupport {

    @Test
    void seeded_calendar_clients_and_sales() throws Exception {
        Session dana = login(DANA, DEMO_PASSWORD);
        JsonNode list = shop(dana, "GET", "/api/appointments", null).path("data");
        assertThat(list.size()).isGreaterThan(50);
        JsonNode first = find(list, "BK-04101");
        assertThat(first.path("date").asText()).isEqualTo(today().toString());
        assertThat(first.path("start").asInt()).isEqualTo(510);
        assertThat(first.path("status").asText()).isEqualTo("COMPLETED");
        assertThat(first.path("saleId").isTextual()).isTrue();
        assertThat(first.path("log").get(1).path("code").asText()).isEqualTo("paid");
        assertThat(find(list, "BK-04116").path("status").asText()).isEqualTo("REQUESTED");
        assertThat(find(list, "BK-04116").path("note").asText()).isEqualTo("First time. Wants a short bob.");

        assertThat(shop(dana, "GET", "/api/clients", null).path("data").size()).isGreaterThanOrEqualTo(15);
        JsonNode sales = shop(dana, "GET", "/api/sales", null).path("data");
        assertThat(sales.size()).isGreaterThan(30);
        assertThat(shop(dana, "GET", "/api/blocks?from=" + today() + "&to=" + today(), null).path("data")).hasSize(2);

        // A product shop has no calendar.
        Session nita = login(NITA, DEMO_PASSWORD);
        assertThat(code(shop(nita, NITA_GADGET_ID, "GET", "/api/appointments", null))).isEqualTo("WRONG_BUSINESS_TYPE");
    }

    @Test
    void phone_and_walk_in_bookings_status_flow_and_undo() throws Exception {
        Session dana = login(DANA, DEMO_PASSWORD);
        LocalDate day = workday(16);
        String phone = uniquePhone();

        Map<String, Object> in = new LinkedHashMap<>();
        in.put("client", Map.of("name", "Neary Chan", "phone", phone));
        in.put("serviceId", CUT);
        in.put("staffId", DANA_ID);
        in.put("date", day.toString());
        in.put("start", 600);
        in.put("source", "PHONE");
        JsonNode a = shop(dana, "POST", "/api/appointments", in).path("data");
        assertThat(a.path("status").asText()).isEqualTo("BOOKED");
        assertThat(a.path("price").decimalValue()).isEqualByComparingTo("8");
        assertThat(a.path("log").get(0).path("code").asText()).isEqualTo("bookedPhone");
        String id = a.path("id").asText();
        String clientId = a.path("clientId").asText();

        // The same phone again finds that client; a walk-in starts as ARRIVED.
        in.put("client", Map.of("name", "Someone Else", "phone", phone));
        in.put("source", "WALK_IN");
        in.put("start", 720);
        JsonNode walk = shop(dana, "POST", "/api/appointments", in).path("data");
        assertThat(walk.path("clientId").asText()).isEqualTo(clientId);
        assertThat(walk.path("client").path("name").asText()).isEqualTo("Neary Chan");
        assertThat(walk.path("status").asText()).isEqualTo("ARRIVED");

        // BOOKED → CONFIRMED → ARRIVED; ARRIVED → BOOKED is not allowed.
        assertThat(status(shop(dana, "POST", "/api/appointments/" + id + "/status", Map.of("status", "CONFIRMED"))))
                .isEqualTo("CONFIRMED");
        assertThat(status(shop(dana, "POST", "/api/appointments/" + id + "/status", Map.of("status", "ARRIVED"))))
                .isEqualTo("ARRIVED");
        assertThat(code(shop(dana, "POST", "/api/appointments/" + id + "/status", Map.of("status", "BOOKED"))))
                .isEqualTo("INVALID_STATUS_TRANSITION");
        assertThat(code(shop(dana, "POST", "/api/appointments/" + id + "/status", Map.of("status", "COMPLETED"))))
                .isEqualTo("VALIDATION_FAILED");

        // No-show, then Undo puts ARRIVED back and drops the log line.
        JsonNode ns = shop(dana, "POST", "/api/appointments/" + id + "/status", Map.of("status", "NO_SHOW")).path("data");
        assertThat(ns.path("status").asText()).isEqualTo("NO_SHOW");
        int logSize = ns.path("log").size();
        JsonNode undone = shop(dana, "POST", "/api/appointments/" + id + "/undo", null).path("data");
        assertThat(undone.path("status").asText()).isEqualTo("ARRIVED");
        assertThat(undone.path("log").size()).isEqualTo(logSize - 1);

        // Cancel needs a known reason; an old change cannot be undone.
        assertThat(code(shop(dana, "POST", "/api/appointments/" + id + "/status", Map.of("status", "CANCELLED"))))
                .isEqualTo("VALIDATION_FAILED");
        JsonNode c = shop(dana, "POST", "/api/appointments/" + id + "/status",
                Map.of("status", "CANCELLED", "reason", "clientAsked")).path("data");
        assertThat(c.path("cancelReason").asText()).isEqualTo("clientAsked");
        jdbc.update("update appointment_event set at = at - interval '1 minute' where appointment_id = ?::uuid", id);
        assertThat(code(shop(dana, "POST", "/api/appointments/" + id + "/undo", null))).isEqualTo("UNDO_WINDOW_PASSED");

        // Creating cannot be undone either.
        assertThat(code(shop(dana, "POST", "/api/appointments/" + walk.path("id").asText() + "/undo", null)))
                .isEqualTo("UNDO_WINDOW_PASSED");
    }

    @Test
    void move_edit_and_decline() throws Exception {
        Session dana = login(DANA, DEMO_PASSWORD);
        LocalDate day = workday(30);
        JsonNode a = shop(dana, "POST", "/api/appointments", Map.of("client",
                Map.of("name", "Rota Pen", "phone", uniquePhone()), "serviceId", CUT, "staffId", DANA_ID,
                "date", day.toString(), "start", 540, "source", "PHONE")).path("data");
        String ref = a.path("number").asText();

        JsonNode moved = shop(dana, "PATCH", "/api/appointments/" + ref,
                Map.of("staffId", VICHEKA_ID, "start", 660)).path("data");
        assertThat(moved.path("staffId").asText()).isEqualTo(VICHEKA_ID);
        JsonNode last = moved.path("log").get(moved.path("log").size() - 1);
        assertThat(last.path("code").asText()).isEqualTo("moved");
        assertThat(last.path("params").path("time").asText()).isEqualTo("11:00");
        assertThat(last.path("params").path("staff").asText()).isEqualTo("Vicheka Sok");
        // Undo the move.
        JsonNode back = shop(dana, "POST", "/api/appointments/" + ref + "/undo", null).path("data");
        assertThat(back.path("staffId").asText()).isEqualTo(DANA_ID);
        assertThat(back.path("start").asInt()).isEqualTo(540);

        JsonNode edited = shop(dana, "PATCH", "/api/appointments/" + ref, Map.of("note", "Bring photos")).path("data");
        assertThat(edited.path("note").asText()).isEqualTo("Bring photos");
        assertThat(edited.path("log").get(edited.path("log").size() - 1).path("code").asText()).isEqualTo("edited");

        // An online request is declined with a reason; the customer hears about it.
        Session c = customer();
        JsonNode req = as(c, "POST", "/api/me/bookings", booking(CUT_SLUG, DANA_ID, day, 900)).path("data");
        assertThat(code(shop(dana, "POST", "/api/appointments/" + req.path("number").asText() + "/status",
                Map.of("status", "DECLINED", "reason", "nope")))).isEqualTo("VALIDATION_FAILED");
        JsonNode declined = shop(dana, "POST", "/api/appointments/" + req.path("number").asText() + "/status",
                Map.of("status", "DECLINED", "reason", "fullyBooked")).path("data");
        assertThat(declined.path("status").asText()).isEqualTo("DECLINED");
        assertThat(as(c, "GET", "/api/me/notifications", null).path("data").toString()).contains("BOOKING_DECLINED");
        assertThat(code(shop(dana, "PATCH", "/api/appointments/" + req.path("number").asText(), Map.of("start", 960))))
                .isEqualTo("INVALID_STATUS_TRANSITION");
    }

    @Test
    void checkout_completes_the_appointment_and_takes_retail_stock() throws Exception {
        Session dana = login(DANA, DEMO_PASSWORD);
        LocalDate day = today();
        JsonNode a = shop(dana, "POST", "/api/appointments", Map.of("client",
                Map.of("name", "Malis Ouk", "phone", uniquePhone()), "serviceId", CUT, "staffId", VICHEKA_ID,
                "date", day.toString(), "start", 1200, "source", "WALK_IN")).path("data");
        String id = a.path("id").asText();
        int stock = jdbc.queryForObject("select stock from product_variant where id = ?::uuid", Integer.class, ARGAN);

        List<Map<String, Object>> lines = List.of(
                Map.of("serviceId", CUT, "title", "Haircut & Style", "qty", 1, "unitPrice", 8, "staffId", VICHEKA_ID),
                Map.of("variantId", ARGAN, "title", "Argan hair oil 50 ml", "qty", 1, "unitPrice", 12));
        Map<String, Object> sale = new LinkedHashMap<>();
        sale.put("appointmentId", id);
        sale.put("lines", lines);
        sale.put("discount", 2);
        sale.put("tip", 1.5);
        sale.put("payments", List.of(Map.of("method", "CASH", "amount", 19)));
        assertThat(code(shop(dana, "POST", "/api/sales", sale))).isEqualTo("VALIDATION_FAILED");
        sale.put("payments", List.of(Map.of("method", "CASH", "amount", 10), Map.of("method", "KHQR", "amount", 9.5)));
        sale.put("cash", Map.of("usd", 10, "khr", 0, "change", 0));
        JsonNode s = shop(dana, "POST", "/api/sales", sale).path("data");
        assertThat(s.path("number").asText()).matches("S-\\d{5,}");
        assertThat(s.path("subtotal").decimalValue()).isEqualByComparingTo("20");
        assertThat(s.path("total").decimalValue()).isEqualByComparingTo("19.50");
        assertThat(s.path("clientId").asText()).isEqualTo(a.path("clientId").asText());
        assertThat(s.path("payments")).hasSize(2);
        assertThat(s.path("byName").asText()).isEqualTo("Try Dana");

        JsonNode done = shop(dana, "GET", "/api/appointments/" + id, null).path("data");
        assertThat(done.path("status").asText()).isEqualTo("COMPLETED");
        assertThat(done.path("saleId").asText()).isEqualTo(s.path("id").asText());
        JsonNode paid = done.path("log").get(done.path("log").size() - 1);
        assertThat(paid.path("code").asText()).isEqualTo("paid");
        assertThat(paid.path("params").path("method").asText()).isEqualTo("SPLIT");
        assertThat(jdbc.queryForObject("select stock from product_variant where id = ?::uuid", Integer.class, ARGAN))
                .isEqualTo(stock - 1);
        assertThat(jdbc.queryForObject("select count(*) from stock_movement where variant_id = ?::uuid and reason = 'POS_SALE' and note = ?",
                Integer.class, ARGAN, s.path("number").asText())).isEqualTo(1);

        // A completed appointment cannot be checked out twice; a quick sale needs no appointment.
        sale.put("payments", List.of(Map.of("method", "CARD", "amount", 19.5)));
        sale.remove("cash");
        assertThat(code(shop(dana, "POST", "/api/sales", sale))).isEqualTo("INVALID_STATUS_TRANSITION");
        JsonNode quick = shop(dana, "POST", "/api/sales", Map.of("lines",
                List.of(Map.of("variantId", ARGAN, "title", "Argan hair oil 50 ml", "qty", 1, "unitPrice", 12)),
                "discount", 0, "tip", 0, "payments", List.of(Map.of("method", "KHQR", "amount", 12)))).path("data");
        assertThat(quick.path("appointmentId").isMissingNode() || quick.path("appointmentId").isNull()).isTrue();
        assertThat(shop(dana, "GET", "/api/sales/" + quick.path("number").asText(), null).path("data")
                .path("total").decimalValue()).isEqualByComparingTo("12");
    }

    @Test
    void blocks_clients_team_deals_and_review_replies() throws Exception {
        Session dana = login(DANA, DEMO_PASSWORD);
        LocalDate day = workday(40);

        JsonNode b = shop(dana, "POST", "/api/blocks", Map.of("staffId", DANA_ID, "date", day.toString(),
                "start", 720, "durationMin", 60, "reason", "LUNCH")).path("data");
        assertThat(b.path("reason").asText()).isEqualTo("LUNCH");
        // Online availability skips the blocked hour.
        JsonNode av = body(mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .get("/api/marketplace/items/" + CUT_SLUG + "/availability?from=" + day + "&days=1&staffId=" + DANA_ID))
                .andReturn()).path("data").path("days").get(0).path("slots");
        for (JsonNode s : av) {
            if (s.path("start").asInt() == 720 || s.path("start").asInt() == 690) {
                assertThat(s.path("staffIds")).isEmpty();
            }
        }
        assertThat(code(shop(dana, "DELETE", "/api/blocks/" + b.path("id").asText(), null))).isEqualTo("SUCCESS");

        String phone = uniquePhone();
        JsonNode c = shop(dana, "POST", "/api/clients", Map.of("name", "Vanna Kim", "phone", phone, "note", "VIP"))
                .path("data");
        assertThat(c.path("note").asText()).isEqualTo("VIP");
        assertThat(code(shop(dana, "POST", "/api/clients", Map.of("name", "Other", "phone", phone))))
                .isEqualTo("DUPLICATE_CLIENT");
        JsonNode cleared = shop(dana, "PATCH", "/api/clients/" + c.path("id").asText(), Map.of("note", "")).path("data");
        assertThat(cleared.path("note").isMissingNode() || cleared.path("note").isNull()).isTrue();

        Map<String, Object> shifts = new LinkedHashMap<>();
        shifts.put("name", "Sophy Lim");
        shifts.put("title", "Junior stylist");
        shifts.put("color", "#2f6fd6");
        shifts.put("shifts", java.util.Arrays.asList(List.of(540, 1020), List.of(540, 1020), null, null, null, null, null));
        JsonNode m = shop(dana, "POST", "/api/businesses/" + GLOW_BEAUTY_ID + "/members", shifts).path("data");
        assertThat(m.path("role").asText()).isEqualTo("STAFF");
        assertThat(m.path("color").asText()).isEqualTo("#2F6FD6");
        assertThat(m.path("shifts").get(2).isNull()).isTrue();
        JsonNode m2 = shop(dana, "PATCH", "/api/businesses/" + GLOW_BEAUTY_ID + "/members/" + m.path("id").asText(),
                Map.of("title", "Stylist", "active", false)).path("data");
        assertThat(m2.path("title").asText()).isEqualTo("Stylist");
        assertThat(m2.path("active").asBoolean()).isFalse();
        assertThat(code(shop(dana, "PATCH", "/api/businesses/" + GLOW_BEAUTY_ID + "/members/" + DANA_ID,
                Map.of("active", false)))).isEqualTo("VALIDATION_FAILED");
        Map<String, Object> bad = new LinkedHashMap<>();
        bad.put("shifts", java.util.Arrays.asList(List.of(600, 540), null, null, null, null, null, null));
        assertThat(code(shop(dana, "PATCH", "/api/businesses/" + GLOW_BEAUTY_ID + "/members/" + m.path("id").asText(),
                bad))).isEqualTo("VALIDATION_FAILED");

        JsonNode deal = shop(dana, "POST", "/api/deals", Map.of("title", "Rainy-day blow-dry", "body", "15% off washes.",
                "discountPct", 15, "serviceIds", List.of("cccccccc-0000-4000-8000-000000000009"),
                "start", today().toString(), "end", today().plusDays(6).toString())).path("data");
        assertThat(deal.path("start").asText()).isEqualTo(today().toString());
        assertThat(deal.path("end").asText()).isEqualTo(today().plusDays(6).toString());
        JsonNode deals = shop(dana, "GET", "/api/deals", null).path("data");
        assertThat(deals.toString()).contains("Rainy-day blow-dry").contains("Free nail art on gel sets");
        JsonNode upd = shop(dana, "PATCH", "/api/deals/" + deal.path("id").asText(),
                Map.of("end", today().plusDays(2).toString())).path("data");
        assertThat(upd.path("end").asText()).isEqualTo(today().plusDays(2).toString());
        assertThat(code(shop(dana, "POST", "/api/deals", Map.of("title", "X", "body", "Y", "serviceIds",
                List.of("cccccccc-0000-4000-8000-000000000001"), "start", today().toString(),
                "end", today().toString())))).isEqualTo("VALIDATION_FAILED");
        assertThat(code(shop(dana, "DELETE", "/api/deals/" + deal.path("id").asText(), null))).isEqualTo("SUCCESS");
        // The description is optional.
        JsonNode bare = shop(dana, "POST", "/api/deals", Map.of("title", "No description", "discountPct", 10,
                "serviceIds", List.of("cccccccc-0000-4000-8000-000000000009"), "start", today().toString(),
                "end", today().plusDays(1).toString())).path("data");
        assertThat(bare.path("body").asText()).isEmpty();
        shop(dana, "DELETE", "/api/deals/" + bare.path("id").asText(), null);

        JsonNode reviews = shop(dana, "GET", "/api/reviews", null).path("data");
        assertThat(reviews.size()).isGreaterThan(0);
        String rid = reviews.get(0).path("id").asText();
        JsonNode replied = shop(dana, "POST", "/api/reviews/" + rid + "/reply", Map.of("text", "Thank you!")).path("data");
        assertThat(replied.path("reply").asText()).isEqualTo("Thank you!");
    }

    private static JsonNode find(JsonNode list, String number) {
        for (JsonNode a : list) {
            if (a.path("number").asText().equals(number)) {
                return a;
            }
        }
        throw new AssertionError(number + " not in the list");
    }

    private static String status(JsonNode r) {
        return r.path("data").path("status").asText();
    }
}
