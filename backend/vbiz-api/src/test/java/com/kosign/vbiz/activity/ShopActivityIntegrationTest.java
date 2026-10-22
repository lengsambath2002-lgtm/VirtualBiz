package com.kosign.vbiz.activity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.booking.BookingTestSupport;

/** The shop activity log (docs/api/phase18-shop-activity.md). */
class ShopActivityIntegrationTest extends BookingTestSupport {

    private JsonNode latest(Session s, String businessId, String query) throws Exception {
        return shop(s, businessId, "GET", "/api/activity?size=5" + query, null).path("data").path("items").path(0);
    }

    @Test
    void shop_actions_are_logged_with_who_and_what() throws Exception {
        Session dana = login(DANA, DEMO_PASSWORD);
        String phone = uniquePhone();
        JsonNode c = shop(dana, "POST", "/api/clients", Map.of("name", "Logged Client", "phone", phone)).path("data");
        JsonNode added = latest(dana, GLOW_BEAUTY_ID, "&action=CUSTOMER_ADDED");
        assertThat(added.path("targetId").asText()).isEqualTo(c.path("id").asText());
        assertThat(added.path("targetLabel").asText()).isEqualTo("Logged Client");
        assertThat(added.path("actorName").asText()).isNotBlank();

        shop(dana, "PATCH", "/api/clients/" + c.path("id").asText(), Map.of("note", "VIP"));
        JsonNode edited = latest(dana, GLOW_BEAUTY_ID, "&targetId=" + c.path("id").asText());
        assertThat(edited.path("action").asText()).isEqualTo("CUSTOMER_EDITED");
        assertThat(edited.path("details").path("fields").asText()).isEqualTo("note");

        shop(dana, "PATCH", "/api/businesses/" + GLOW_BEAUTY_ID, Map.of("about", "Hair, nails and more"));
        JsonNode settings = latest(dana, GLOW_BEAUTY_ID, "&action=SETTINGS_CHANGED");
        assertThat(settings.path("details").path("fields").asText()).isEqualTo("about");

        JsonNode svc = shop(dana, "GET", "/api/catalog/services", null).path("data").path(0);
        shop(dana, "POST", "/api/catalog/services/online", Map.of("ids", List.of(svc.path("id").asText()),
                "online", true));
        assertThat(latest(dana, GLOW_BEAUTY_ID, "&action=SERVICES_ONLINE").path("details").path("count").asInt())
                .isEqualTo(1);

        mvc.perform(get("/api/exports/customers").header("Authorization", dana.bearer())
                .header("X-Business-Id", GLOW_BEAUTY_ID));
        assertThat(latest(dana, GLOW_BEAUTY_ID, "&action=DATA_EXPORTED").path("targetId").asText())
                .isEqualTo("customers");
    }

    @Test
    void a_refused_action_leaves_no_row_and_staff_cannot_read_the_log() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        long before = shop(nita, NITA_GADGET_ID, "GET", "/api/activity?action=CUSTOMER_ADDED", null).path("data")
                .path("total").asLong();
        // A phone another customer has: refused, nothing logged.
        String taken = jdbc.queryForObject("select phone from client where business_id = ?::uuid limit 1",
                String.class, NITA_GADGET_ID);
        assertThat(code(shop(nita, NITA_GADGET_ID, "POST", "/api/clients", Map.of("name", "Dup", "phone", taken))))
                .isEqualTo("DUPLICATE_CLIENT");
        assertThat(shop(nita, NITA_GADGET_ID, "GET", "/api/activity?action=CUSTOMER_ADDED", null).path("data")
                .path("total").asLong()).isEqualTo(before);

        JsonNode inv = shop(nita, NITA_GADGET_ID, "POST", "/api/businesses/" + NITA_GADGET_ID + "/invites",
                Map.of("email", uniqueEmail("act"), "name", "Log Staff", "role", "STAFF"));
        assertThat(latest(nita, NITA_GADGET_ID, "&action=TEAM_INVITED").path("details").path("role").asText())
                .isEqualTo("STAFF");
        String token = inv.path("data").path("devLink").asText().replace("/join/", "");
        Session staff = session(mvc.perform(postJson("/api/join/" + token + "/accept",
                Map.of("name", "Log Staff", "password", "Bright#2026x"))).andReturn());
        assertThat(code(shop(staff, NITA_GADGET_ID, "GET", "/api/activity", null))).isEqualTo("FORBIDDEN");

        String csv = mvc.perform(get("/api/activity/export?action=TEAM_INVITED").header("Authorization", nita.bearer())
                .header("X-Business-Id", NITA_GADGET_ID)).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        assertThat(csv).startsWith("﻿\"Time\",\"Who\",\"Action\"").contains("TEAM_INVITED");
    }

    @Test
    void the_platform_does_not_read_a_shops_own_activity_log() throws Exception {
        Session admin = login("admin@virtualbiz.com", DEMO_PASSWORD);
        // Not a member of the shop: its team's log stays the shop's own.
        assertThat(code(shop(admin, GLOW_BEAUTY_ID, "GET", "/api/activity", null))).isIn("FORBIDDEN_TENANT",
                "FORBIDDEN");
        JsonNode detail = body(mvc.perform(get("/api/admin/businesses/" + GLOW_BEAUTY_ID)
                .header("Authorization", admin.bearer())).andReturn()).path("data");
        assertThat(detail.path("owner").path("role").asText()).isEqualTo("OWNER");
        assertThat(detail.path("teamSize").asLong()).isPositive();
        assertThat(detail.has("members")).isFalse();
    }
}
