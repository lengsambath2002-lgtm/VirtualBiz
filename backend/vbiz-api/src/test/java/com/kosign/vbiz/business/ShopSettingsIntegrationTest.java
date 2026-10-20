package com.kosign.vbiz.business;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.booking.BookingTestSupport;

/** A shop's own policy and rules (docs/api/phase11-shop-settings.md). */
class ShopSettingsIntegrationTest extends BookingTestSupport {

    private static final String CABLE = "bbbbbbbb-0000-4000-8000-000018000000";

    @Test
    void the_owner_sets_receipt_vat_links_and_counter_payment_methods() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        String path = "/api/businesses/" + NITA_GADGET_ID;
        JsonNode before = shop(nita, NITA_GADGET_ID, "GET", path, null).path("data").path("policy");
        assertThat(before.path("payCash").asBoolean()).isTrue();
        assertThat(before.path("taxPct").decimalValue()).isZero();

        Map<String, Object> policy = new LinkedHashMap<>();
        policy.put("receiptFooter", "Exchange within 14 days with this receipt.");
        policy.put("taxPct", 10);
        policy.put("taxId", "K001-901234567");
        policy.put("payCard", false);
        policy.put("facebook", "facebook.com/nitagadget");
        JsonNode saved = shop(nita, NITA_GADGET_ID, "PATCH", path, Map.of("policy", policy)).path("data").path("policy");
        assertThat(saved.path("receiptFooter").asText()).startsWith("Exchange within 14 days");
        assertThat(saved.path("taxPct").decimalValue()).isEqualByComparingTo("10");
        assertThat(saved.path("payCard").asBoolean()).isFalse();
        assertThat(saved.path("payKhqr").asBoolean()).isTrue();
        // A later patch merges: the footer stays.
        JsonNode merged = shop(nita, NITA_GADGET_ID, "PATCH", path, Map.of("policy", Map.of("telegram", "@nitagadget")))
                .path("data").path("policy");
        assertThat(merged.path("receiptFooter").asText()).startsWith("Exchange within 14 days");
        assertThat(merged.path("telegram").asText()).isEqualTo("@nitagadget");

        assertThat(code(shop(nita, NITA_GADGET_ID, "PATCH", path, Map.of("policy", Map.of("taxPct", 25)))))
                .isEqualTo("VALIDATION_FAILED");
        assertThat(code(shop(nita, NITA_GADGET_ID, "PATCH", path,
                Map.of("policy", Map.of("payCash", false, "payKhqr", false))))).isEqualTo("VALIDATION_FAILED");

        // The register refuses a method the shop doesn't take.
        Map<String, Object> sale = new LinkedHashMap<>();
        sale.put("clientRef", UUID.randomUUID().toString());
        sale.put("lines", List.of(Map.of("variantId", CABLE, "qty", 1, "unitPrice", 6)));
        sale.put("discount", 0);
        sale.put("payments", List.of(Map.of("method", "CARD", "amount", 6)));
        JsonNode refused = shop(nita, NITA_GADGET_ID, "POST", "/api/pos/sales", sale);
        assertThat(code(refused)).isEqualTo("VALIDATION_FAILED");
        assertThat(refused.path("error").path("details").get(0).path("field").asText()).isEqualTo("payments[0].method");

        // Back to the defaults for the other tests.
        shop(nita, NITA_GADGET_ID, "PATCH", path, Map.of("policy", Map.of("payCard", true, "taxPct", 0)));
    }

    @Test
    void a_provider_sets_the_slot_interval_and_how_far_ahead_clients_book() throws Exception {
        Session dana = login(DANA, DEMO_PASSWORD);
        String path = "/api/businesses/" + GLOW_BEAUTY_ID;
        assertThat(code(shop(dana, "PATCH", path, Map.of("bookingSettings", Map.of("slotMinutes", 7)))))
                .isEqualTo("VALIDATION_FAILED");
        assertThat(code(shop(dana, "PATCH", path, Map.of("bookingSettings", Map.of("tipPresets", List.of(5, 80))))))
                .isEqualTo("VALIDATION_FAILED");
        JsonNode bs = shop(dana, "PATCH", path, Map.of("bookingSettings",
                Map.of("slotMinutes", 15, "maxDaysAhead", 3, "tipPresets", List.of(0, 10, 20)))).path("data")
                .path("bookingSettings");
        assertThat(bs.path("slotMinutes").asInt()).isEqualTo(15);

        LocalDate from = today();
        JsonNode a = body(mvc.perform(get("/api/marketplace/items/" + CUT_SLUG + "/availability?from=" + from
                + "&days=7")).andReturn()).path("data");
        assertThat(a.path("step").asInt()).isEqualTo(15);
        for (JsonNode d : a.path("days")) {
            LocalDate date = LocalDate.parse(d.path("date").asText());
            if (date.isAfter(from.plusDays(3))) {
                assertThat(d.path("open").asBoolean()).as("past the horizon: " + date).isFalse();
            }
            for (JsonNode slot : d.path("slots")) {
                assertThat(slot.path("start").asInt() % 15).isZero();
            }
        }

        // Back to the defaults for the other tests.
        shop(dana, "PATCH", path, Map.of("bookingSettings", Map.of("slotMinutes", 30, "maxDaysAhead", 90)));
    }
}
