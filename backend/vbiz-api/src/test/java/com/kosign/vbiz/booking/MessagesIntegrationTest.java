package com.kosign.vbiz.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import java.time.LocalDate;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.booking.scheduler.BookingReminders;
import com.kosign.vbiz.booking.service.Availability;

/** Receipts shops can share, the decline message, booking reminders (docs/api/phase13-messages.md). */
class MessagesIntegrationTest extends BookingTestSupport {

    @Autowired
    BookingReminders reminders;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void a_shop_shares_a_receipt_link_anyone_can_open() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        String number = jdbc.queryForObject(
                "select number from sale where business_id = ?::uuid order by at desc limit 1", String.class,
                NITA_GADGET_ID);
        JsonNode shared = shop(nita, NITA_GADGET_ID, "POST", "/api/sales/" + number + "/share", null).path("data");
        String token = shared.path("token").asText();
        assertThat(shared.path("path").asText()).isEqualTo("/r/" + token);
        // Sharing again gives the same link.
        assertThat(shop(nita, NITA_GADGET_ID, "POST", "/api/sales/" + number + "/share", null).path("data")
                .path("token").asText()).isEqualTo(token);

        JsonNode r = body(mvc.perform(get("/api/receipts/" + token)).andReturn()).path("data");
        assertThat(r.path("number").asText()).isEqualTo(number);
        assertThat(r.path("shop").path("name").asText()).isEqualTo("Nita Gadget Store");
        assertThat(r.path("lines").size()).isPositive();
        assertThat(r.path("total").decimalValue()).isPositive();

        // Another shop can't share it; a made-up link finds nothing.
        Session dana = login(DANA, DEMO_PASSWORD);
        assertThat(code(shop(dana, "POST", "/api/sales/" + number + "/share", null))).isEqualTo("SALE_NOT_FOUND");
        assertThat(code(body(mvc.perform(get("/api/receipts/nope")).andReturn()))).isEqualTo("SALE_NOT_FOUND");
    }

    @Test
    void the_client_reads_the_providers_decline_message() throws Exception {
        Session dana = login(DANA, DEMO_PASSWORD);
        Session c = customer();
        JsonNode b = as(c, "POST", "/api/me/bookings", booking(CUT_SLUG, null, workday(40), 660)).path("data");
        String number = b.path("number").asText();
        JsonNode declined = shop(dana, "POST", "/api/appointments/" + number + "/status", Map.of("status", "DECLINED",
                "reason", "fullyBooked", "message", "Fully booked that day. Thursday at 11:00 is free!")).path("data");
        assertThat(declined.path("status").asText()).isEqualTo("DECLINED");
        JsonNode mine = as(c, "GET", "/api/me/bookings/" + number, null).path("data");
        assertThat(mine.path("declineMessage").asText()).startsWith("Fully booked that day");
        String inbox = as(c, "GET", "/api/me/notifications", null).path("data").toString();
        assertThat(inbox).as(inbox).contains("BOOKING_DECLINED").contains("Thursday at 11:00 is free");
    }

    @Test
    void a_booked_client_gets_one_reminder_the_shops_hours_before() throws Exception {
        Session dana = login(DANA, DEMO_PASSWORD);
        Session c = customer();
        LocalDate day = workday(30);
        JsonNode b = as(c, "POST", "/api/me/bookings", booking(CUT_SLUG, null, day, 600)).path("data");
        String number = b.path("number").asText();
        shop(dana, "POST", "/api/appointments/" + number + "/status", Map.of("status", "BOOKED"));
        var start = Availability.instantOf(day, 600);

        // 25 h before a 24 h reminder: nothing yet. 23 h before: sent, once.
        reminders.run(start.minusSeconds(25 * 3600));
        assertThat(as(c, "GET", "/api/me/notifications", null).path("data").toString()).doesNotContain("BOOKING_REMINDER");
        assertThat(reminders.run(start.minusSeconds(23 * 3600))).isPositive();
        JsonNode inbox = as(c, "GET", "/api/me/notifications", null).path("data");
        assertThat(inbox.toString()).contains("BOOKING_REMINDER").contains(number);
        reminders.run(start.minusSeconds(22 * 3600));
        assertThat(jdbc.queryForObject("select count(*) from notification where user_id = ?::uuid and kind = 'BOOKING_REMINDER'",
                Integer.class, c.user().path("id").asText())).isEqualTo(1);
    }
}
