package com.kosign.vbiz.report;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.booking.BookingTestSupport;

/** CSV exports and customer edits (docs/api/phase14-customers-exports.md). */
class ExportIntegrationTest extends BookingTestSupport {

    private MockHttpServletResponse export(Session s, String businessId, String path) throws Exception {
        return mvc.perform(get(path).header("Authorization", s.bearer()).header("X-Business-Id", businessId))
                .andReturn().getResponse();
    }

    @Test
    void an_owner_downloads_products_customers_and_sales_as_csv() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);

        MockHttpServletResponse products = export(nita, NITA_GADGET_ID, "/api/exports/products");
        assertThat(products.getStatus()).isEqualTo(200);
        assertThat(products.getContentType()).startsWith("text/csv");
        assertThat(products.getHeader("Content-Disposition"))
                .contains("attachment").contains("products-").contains(".csv");
        assertThat(products.getHeader("Cache-Control")).contains("no-store");
        String csv = products.getContentAsString(StandardCharsets.UTF_8);
        assertThat(csv).startsWith("﻿\"Product\",\"Variant\",\"SKU\"");
        assertThat(csv).contains("USB-C to USB-C Cable");
        assertThat(Integer.parseInt(products.getHeader("X-Row-Count"))).isPositive();

        String sales = export(nita, NITA_GADGET_ID, "/api/exports/sales?from=2020-01-01&to=2020-12-31")
                .getContentAsString(StandardCharsets.UTF_8);
        assertThat(sales.lines().count()).as("header only for an empty range").isEqualTo(1);

        // A range over a year, or backwards, is refused.
        assertThat(code(body(mvc.perform(get("/api/exports/orders?from=2025-01-01&to=2026-06-01")
                .header("Authorization", nita.bearer()).header("X-Business-Id", NITA_GADGET_ID)).andReturn())))
                .isEqualTo("VALIDATION_FAILED");
        // Appointments are a service provider's; an unknown kind is refused.
        assertThat(export(nita, NITA_GADGET_ID, "/api/exports/appointments").getStatus()).isNotEqualTo(200);
        assertThat(export(nita, NITA_GADGET_ID, "/api/exports/payroll").getStatus()).isNotEqualTo(200);
    }

    @Test
    void a_customer_edited_with_a_formula_name_stays_plain_text_in_the_export() throws Exception {
        Session dana = login(DANA, DEMO_PASSWORD);
        JsonNode c = shop(dana, "POST", "/api/clients", Map.of("name", "Sok Pisey", "phone", uniquePhone()))
                .path("data");
        JsonNode edited = shop(dana, "PATCH", "/api/clients/" + c.path("id").asText(),
                Map.of("name", "=HYPERLINK(\"x\")", "district", "Daun Penh", "note", "Likes window seats"))
                .path("data");
        assertThat(edited.path("district").asText()).isEqualTo("Daun Penh");
        assertThat(edited.path("note").asText()).isEqualTo("Likes window seats");

        String csv = export(dana, GLOW_BEAUTY_ID, "/api/exports/customers").getContentAsString(StandardCharsets.UTF_8);
        assertThat(csv).contains("\"'=HYPERLINK(\"\"x\"\")\"").contains("\"Daun Penh\"");

        assertThat(code(shop(dana, "PATCH", "/api/clients/" + c.path("id").asText(),
                Map.of("district", "Atlantis")))).isEqualTo("DISTRICT_NOT_FOUND");
        String appts = export(dana, GLOW_BEAUTY_ID, "/api/exports/appointments")
                .getContentAsString(StandardCharsets.UTF_8);
        assertThat(appts).startsWith("﻿\"Booking\",\"Date\"");
    }

    @Test
    void a_product_shop_edits_its_customers_but_staff_cannot_export() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        JsonNode first = shop(nita, NITA_GADGET_ID, "GET", "/api/clients", null).path("data").path(0);
        JsonNode edited = shop(nita, NITA_GADGET_ID, "PATCH", "/api/clients/" + first.path("id").asText(),
                Map.of("note", "VIP: wholesale prices")).path("data");
        assertThat(edited.path("note").asText()).isEqualTo("VIP: wholesale prices");

        JsonNode inv = shop(nita, NITA_GADGET_ID, "POST", "/api/businesses/" + NITA_GADGET_ID + "/invites",
                Map.of("email", uniqueEmail("exp"), "name", "Counter Staff", "role", "STAFF"));
        String token = inv.path("data").path("devLink").asText().replace("/join/", "");
        Session staff = session(mvc.perform(postJson("/api/join/" + token + "/accept",
                Map.of("name", "Counter Staff", "password", "Bright#2026x"))).andReturn());
        assertThat(code(body(mvc.perform(get("/api/exports/customers").header("Authorization", staff.bearer())
                .header("X-Business-Id", NITA_GADGET_ID)).andReturn()))).isEqualTo("FORBIDDEN");
    }
}
