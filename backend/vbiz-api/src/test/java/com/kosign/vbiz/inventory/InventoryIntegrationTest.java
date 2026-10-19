package com.kosign.vbiz.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.support.IntegrationTest;

class InventoryIntegrationTest extends IntegrationTest {

    /** Nita's USB-C cable (seeded stock 64). */
    private static final String CABLE = "bbbbbbbb-0000-4000-8000-000018000000";
    /** Nita's Apple Watch M/L (stock 2, alert at 2). */
    private static final String WATCH_ML = "bbbbbbbb-0000-4000-8000-000015000001";

    @Autowired
    JdbcTemplate jdbc;

    private int stockOf(String variantId) {
        return jdbc.queryForObject("select stock from product_variant where id = ?::uuid", Integer.class, variantId);
    }

    private JsonNode write(Session s, Map<String, Object> body) throws Exception {
        return body(mvc.perform(post("/api/inventory/movements").header("Authorization", s.bearer())
                        .header("X-Business-Id", NITA_GADGET_ID).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(body)))
                .andReturn());
    }

    @Test
    void seeded_stock_equals_the_movement_log() {
        Integer bad = jdbc.queryForObject("""
                select count(*) from product_variant v
                where v.stock <> (select coalesce(sum(delta), 0) from stock_movement m where m.variant_id = v.id)""",
                Integer.class);
        assertThat(bad).isZero();
    }

    @Test
    void adjust_merge_quick_and_undo() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        int before = stockOf(CABLE);
        JsonNode r = write(nita, Map.of("variantId", CABLE, "delta", 5, "reason", "RECEIVED", "note", "PO-9"));
        assertThat(r.path("data").path("variant").path("stock").asInt()).isEqualTo(before + 5);
        assertThat(r.path("data").path("movement").path("reason").asText()).isEqualTo("RECEIVED");
        assertThat(r.path("data").path("movement").path("byName").asText()).isEqualTo("Kry Sonita");
        String received = r.path("data").path("movement").path("id").asText();

        Map<String, Object> plus = new HashMap<>(Map.of("variantId", CABLE, "delta", 1, "reason", "QUICK_ADJUST",
                "mergeQuick", true));
        JsonNode q1 = write(nita, plus).path("data");
        JsonNode q2 = write(nita, plus).path("data");
        assertThat(q1.path("merged").asBoolean()).isFalse();
        assertThat(q2.path("merged").asBoolean()).isTrue();
        assertThat(q2.path("movement").path("id").asText()).isEqualTo(q1.path("movement").path("id").asText());
        assertThat(q2.path("movement").path("delta").asInt()).isEqualTo(2);
        assertThat(stockOf(CABLE)).isEqualTo(before + 7);

        mvc.perform(get("/api/inventory/movements").param("variantId", CABLE).header("Authorization", nita.bearer())
                        .header("X-Business-Id", NITA_GADGET_ID))
                .andExpect(jsonPath("$.data[0].reason").value("QUICK_ADJUST"))
                .andExpect(jsonPath("$.data[0].delta").value(2))
                .andExpect(jsonPath("$.data[1].id").value(received));

        // undo the receipt
        mvc.perform(delete("/api/inventory/movements/" + received).header("Authorization", nita.bearer())
                        .header("X-Business-Id", NITA_GADGET_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.variant.stock").value(before + 2));
        mvc.perform(delete("/api/inventory/movements/" + received).header("Authorization", nita.bearer())
                        .header("X-Business-Id", NITA_GADGET_ID))
                .andExpect(jsonPath("$.status.code").value("MOVEMENT_NOT_FOUND"));

        // the marketplace sees the live count
        mvc.perform(get("/api/marketplace/items/nita-cable"))
                .andExpect(jsonPath("$.data.variants[0].stock").value(before + 2));
    }

    @Test
    void stock_never_goes_negative_and_reasons_are_checked() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        int stock = stockOf(CABLE);
        JsonNode r = write(nita, Map.of("variantId", CABLE, "delta", -(stock + 1), "reason", "DAMAGED_LOST"));
        assertThat(r.path("status").path("code").asText()).isEqualTo("INSUFFICIENT_STOCK");
        assertThat(r.path("error").path("details").get(0).path("meta").path("stock").asInt()).isEqualTo(stock);
        assertThat(write(nita, Map.of("variantId", CABLE, "delta", 3, "reason", "OPENING_STOCK"))
                .path("error").path("details").get(0).path("field").asText()).isEqualTo("reason");
        assertThat(write(nita, Map.of("variantId", CABLE, "delta", 3, "reason", "RECEIVED", "system", true))
                .path("status").path("code").asText()).isEqualTo("VALIDATION_FAILED");
        assertThat(write(nita, Map.of("variantId", CABLE, "delta", 0, "reason", "RECEIVED"))
                .path("status").path("code").asText()).isEqualTo("VALIDATION_FAILED");
        // another shop's variant
        assertThat(write(nita, Map.of("variantId", "bbbbbbbb-0000-4000-8000-000001000000", "delta", 1,
                "reason", "RECEIVED")).path("status").path("code").asText()).isEqualTo("VARIANT_NOT_FOUND");
        // Order and register movements are server-only (Phases 3 and 5 write them through the stock writer).
        for (String reason : new String[] {"ORDER_CANCELLED", "ORDER_SALE", "POS_SALE", "POS_REFUND"}) {
            JsonNode refused = write(nita, Map.of("variantId", CABLE, "delta", 1, "reason", reason, "note", "VB-01041"));
            assertThat(refused.path("status").path("code").asText()).isEqualTo("VALIDATION_FAILED");
            assertThat(refused.path("error").path("details").get(0).path("field").asText()).isEqualTo("reason");
        }
        assertThat(write(nita, Map.of("variantId", CABLE, "delta", 1, "reason", "RECEIVED", "system", true))
                .path("error").path("details").get(0).path("field").asText()).isEqualTo("system");
        assertThat(stockOf(CABLE)).isEqualTo(stock);
        assertThat(jdbc.queryForObject("""
                select count(*) from product_variant v
                where v.stock <> (select coalesce(sum(delta), 0) from stock_movement m where m.variant_id = v.id)""",
                Integer.class)).isZero();
    }

    @Test
    void low_stock_alerts() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        JsonNode all = body(mvc.perform(get("/api/inventory/alerts").header("Authorization", nita.bearer())
                .header("X-Business-Id", NITA_GADGET_ID)).andReturn()).path("data");
        boolean watch = false;
        for (JsonNode a : all) {
            assertThat(a.path("stock").asInt()).isLessThanOrEqualTo(a.path("lowStockAt").asInt());
            watch |= a.path("variantId").asText().equals(WATCH_ML);
        }
        assertThat(watch).isTrue();
        JsonNode out = body(mvc.perform(get("/api/inventory/alerts").param("state", "OUT")
                .header("Authorization", nita.bearer()).header("X-Business-Id", NITA_GADGET_ID)).andReturn())
                .path("data");
        assertThat(out.size()).isGreaterThan(0);
        out.forEach(a -> assertThat(a.path("stock").asInt()).isZero());
    }
}
