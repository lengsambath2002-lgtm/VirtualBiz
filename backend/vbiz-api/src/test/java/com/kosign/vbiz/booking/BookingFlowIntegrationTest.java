package com.kosign.vbiz.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;

/** The customer's booking flow against Glow Beauty Salon (docs/api/phase4-bookings-provider.md § Customer). */
class BookingFlowIntegrationTest extends BookingTestSupport {

    @Test
    void availability_is_public_and_follows_hours_shifts_and_closures() throws Exception {
        LocalDate from = today();
        JsonNode a = body(mvc.perform(get("/api/marketplace/items/" + CUT_SLUG + "/availability?from=" + from + "&days=14"))
                .andExpect(status().isOk()).andReturn()).path("data");
        assertThat(a.path("durationMin").asInt()).isEqualTo(45);
        assertThat(a.path("step").asInt()).isEqualTo(30);
        assertThat(a.path("days")).hasSize(14);
        for (JsonNode d : a.path("days")) {
            LocalDate date = LocalDate.parse(d.path("date").asText());
            boolean shut = date.getDayOfWeek().getValue() == 7 || date.equals(today().plusDays(9));
            assertThat(d.path("open").asBoolean()).as(date.toString()).isEqualTo(!shut);
            for (JsonNode s : d.path("slots")) {
                for (JsonNode id : s.path("staffIds")) {
                    assertThat(id.asText()).isIn(DANA_ID, VICHEKA_ID);
                }
            }
        }
        // Today's 17:00 request for Dana counts as taken online.
        JsonNode todays = a.path("days").get(0);
        for (JsonNode s : todays.path("slots")) {
            if (s.path("start").asInt() == 1020) {
                assertThat(s.path("staffIds").toString()).doesNotContain(DANA_ID);
            }
        }
        JsonNode one = body(mvc.perform(get("/api/marketplace/items/" + CUT_SLUG + "/availability?days=3&staffId="
                + VICHEKA_ID)).andReturn()).path("data");
        for (JsonNode d : one.path("days")) {
            for (JsonNode s : d.path("slots")) {
                for (JsonNode id : s.path("staffIds")) {
                    assertThat(id.asText()).isEqualTo(VICHEKA_ID);
                }
            }
        }
        assertThat(code(body(mvc.perform(get("/api/marketplace/items/nope/availability")).andReturn())))
                .isEqualTo("LISTING_NOT_FOUND");
    }

    @Test
    void book_accept_reschedule_and_cancel() throws Exception {
        Session dana = login(DANA, DEMO_PASSWORD);
        Session c = customer();
        LocalDate day = workday(5);

        // Anyone available at 10:00 → Dana (owner first); Glow does not auto-confirm.
        JsonNode b = as(c, "POST", "/api/me/bookings", booking(CUT_SLUG, null, day, 600)).path("data");
        assertThat(b.path("number").asText()).matches("BK-\\d{5,}");
        assertThat(b.path("status").asText()).isEqualTo("REQUESTED");
        assertThat(b.path("staff").path("id").asText()).isEqualTo(DANA_ID);
        assertThat(b.path("price").decimalValue()).isEqualByComparingTo("8");
        assertThat(b.path("canChange").asBoolean()).isTrue();
        assertThat(b.path("shop").path("slug").asText()).isEqualTo("glow-beauty");
        String number = b.path("number").asText();

        // The same time for Dana is gone; Vicheka still has it.
        JsonNode taken = as(customer(), "POST", "/api/me/bookings", booking(CUT_SLUG, DANA_ID, day, 600));
        assertThat(code(taken)).isEqualTo("SLOT_UNAVAILABLE");
        assertThat(taken.path("error").path("details").get(0).path("meta").path("reason").asText()).isEqualTo("taken");
        JsonNode other = as(customer(), "POST", "/api/me/bookings", booking(CUT_SLUG, null, day, 600)).path("data");
        assertThat(other.path("staff").path("id").asText()).isEqualTo(VICHEKA_ID);

        // The salon sees the request in its inbox and calendar, accepts it.
        JsonNode inbox = shop(dana, "GET", "/api/notifications", null).path("data");
        assertThat(inbox.toString()).contains("BOOKING_REQUESTED").contains(number);
        JsonNode appt = shop(dana, "GET", "/api/appointments/" + number, null).path("data");
        assertThat(appt.path("source").asText()).isEqualTo("ONLINE");
        assertThat(appt.path("client").path("name").asText()).isEqualTo("Sok Dara");
        assertThat(appt.path("log").get(0).path("code").asText()).isEqualTo("bookedOnline");
        JsonNode accepted = shop(dana, "POST", "/api/appointments/" + number + "/status", Map.of("status", "BOOKED"))
                .path("data");
        assertThat(accepted.path("status").asText()).isEqualTo("BOOKED");
        assertThat(as(c, "GET", "/api/me/notifications", null).path("data").toString()).contains("BOOKING_CONFIRMED");

        // Reschedule to 14:00: the old one is cancelled (rescheduled), the new one is a request again.
        Map<String, Object> move = booking(CUT_SLUG, DANA_ID, day, 840);
        move.put("replaces", number);
        JsonNode moved = as(c, "POST", "/api/me/bookings", move).path("data");
        assertThat(moved.path("status").asText()).isEqualTo("REQUESTED");
        JsonNode old = as(c, "GET", "/api/me/bookings/" + number, null).path("data");
        assertThat(old.path("status").asText()).isEqualTo("CANCELLED");
        assertThat(old.path("rescheduled").asBoolean()).isTrue();
        assertThat(old.path("cancelReason").asText()).isEqualTo("rescheduled");
        // 10:00 is free for Dana again.
        JsonNode again = as(customer(), "POST", "/api/me/bookings", booking(CUT_SLUG, DANA_ID, day, 600)).path("data");
        assertThat(again.path("status").asText()).isEqualTo("REQUESTED");

        // My bookings: upcoming first.
        JsonNode mine = as(c, "GET", "/api/me/bookings", null).path("data");
        assertThat(mine.get(0).path("number").asText()).isEqualTo(moved.path("number").asText());
        List<String> numbers = new ArrayList<>();
        mine.forEach(x -> numbers.add(x.path("number").asText()));
        assertThat(numbers).contains(number);

        // Cancel; someone else's booking is not found.
        JsonNode cancelled = as(c, "POST", "/api/me/bookings/" + moved.path("number").asText() + "/cancel", null)
                .path("data");
        assertThat(cancelled.path("status").asText()).isEqualTo("CANCELLED");
        assertThat(cancelled.path("cancelReason").asText()).isEqualTo("client");
        assertThat(code(as(c, "GET", "/api/me/bookings/" + again.path("number").asText(), null)))
                .isEqualTo("APPOINTMENT_NOT_FOUND");
        assertThat(shop(dana, "GET", "/api/notifications", null).path("data").toString())
                .contains("BOOKING_CANCELLED");
    }

    @Test
    void rules_online_off_notice_outside_and_late_cancel() throws Exception {
        Session c = customer();
        LocalDate day = workday(12);
        assertThat(code(as(c, "POST", "/api/me/bookings", booking(KERA_SLUG, null, day, 600))))
                .isEqualTo("BOOKING_UNAVAILABLE");
        // Before Dana's shift (8:00) and on a closure day.
        JsonNode early = as(c, "POST", "/api/me/bookings", booking(CUT_SLUG, DANA_ID, day, 420));
        assertThat(early.path("error").path("details").get(0).path("meta").path("reason").asText()).isEqualTo("outside");
        JsonNode closed = as(c, "POST", "/api/me/bookings", booking(CUT_SLUG, null, today().plusDays(9), 600));
        assertThat(closed.path("error").path("details").get(0).path("meta").path("reason").asText()).isEqualTo("closed");
        // Someone who does not do haircuts.
        assertThat(code(as(c, "POST", "/api/me/bookings", booking(CUT_SLUG, LEAK_ID, day, 600))))
                .isEqualTo("VALIDATION_FAILED");

        // Gel manicure online is 10% off: $16.20.
        JsonNode gel = as(c, "POST", "/api/me/bookings", booking(GEL_SLUG, null, leakDay(12), 660)).path("data");
        assertThat(gel.path("price").decimalValue()).isEqualByComparingTo("16.20");
        // Moved to within the free-cancellation window: the customer can no longer cancel.
        int soon = java.time.LocalTime.now(PP).getHour() * 60 + 60;
        jdbc.update("update appointment set date = ?, start_min = ? where number = ?", java.sql.Date.valueOf(today()),
                Math.min(soon, 1380), gel.path("number").asText());
        JsonNode late = as(c, "GET", "/api/me/bookings/" + gel.path("number").asText(), null).path("data");
        assertThat(late.path("canChange").asBoolean()).isFalse();
        assertThat(code(as(c, "POST", "/api/me/bookings/" + gel.path("number").asText() + "/cancel", null)))
                .isEqualTo("CANCEL_WINDOW_PASSED");
    }

    @Test
    void the_demo_customer_has_her_seeded_barber_booking() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        JsonNode mine = as(nita, "GET", "/api/me/bookings", null).path("data");
        assertThat(mine.toString()).contains("BK-02201");
        JsonNode bk = as(nita, "GET", "/api/me/bookings/BK-02201", null).path("data");
        assertThat(bk.path("shop").path("slug").asText()).isEqualTo("sambath-barber");
        assertThat(bk.path("staff").path("name").asText()).isEqualTo("Sambath");
        assertThat(bk.path("status").asText()).isEqualTo("BOOKED");
        assertThat(bk.path("canChange").asBoolean()).isTrue();
    }

    @Test
    void typing_someone_elses_phone_does_not_take_over_their_client_record() throws Exception {
        Session dana = login(DANA, DEMO_PASSWORD);
        Session stranger = customer();
        // Chav Rada is a seeded walk-in client (no account) with this phone.
        Map<String, Object> b = booking(CUT_SLUG, null, workday(55), 600);
        b.put("phone", "096 382 813");
        b.put("name", "Someone Else");
        JsonNode booked = as(stranger, "POST", "/api/me/bookings", b).path("data");
        assertThat(booked.path("status").asText()).isEqualTo("REQUESTED");
        JsonNode appt = shop(dana, "GET", "/api/appointments/" + booked.path("number").asText(), null).path("data");
        assertThat(appt.path("client").path("name").asText()).isEqualTo("Chav Rada");
        assertThat(jdbc.queryForObject("select user_id is null from client where id = ?::uuid", Boolean.class,
                appt.path("clientId").asText())).isTrue();
        // The stranger still sees their own booking.
        assertThat(as(stranger, "GET", "/api/me/bookings", null).path("data").toString())
                .contains(booked.path("number").asText());
    }
}
