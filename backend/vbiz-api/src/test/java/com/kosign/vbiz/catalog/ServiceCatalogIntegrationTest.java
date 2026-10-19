package com.kosign.vbiz.catalog;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import com.kosign.vbiz.support.IntegrationTest;

class ServiceCatalogIntegrationTest extends IntegrationTest {

    private static final String LEAK = "33333333-3333-4333-8333-000000000101";
    private static final String DANA_MEMBER = "33333333-3333-4333-8333-000000000002";

    @Test
    void provider_services_and_staff() throws Exception {
        Session dana = login(DANA, DEMO_PASSWORD);
        mvc.perform(get("/api/businesses/" + GLOW_BEAUTY_ID + "/members").header("Authorization", dana.bearer()))
                .andExpect(status().isOk())
                // The seeded three first (other tests may add staff to the shared test database).
                .andExpect(jsonPath("$.data[2].name").value("Vicheka Sok"))
                .andExpect(jsonPath("$.data[0].name").value("Try Dana"))
                .andExpect(jsonPath("$.data[0].role").value("OWNER"))
                .andExpect(jsonPath("$.data[0].color").value("#7C5CFA"))
                .andExpect(jsonPath("$.data[0].shifts.length()").value(7))
                .andExpect(jsonPath("$.data[1].name").value("Srey Leak"));

        mvc.perform(get("/api/catalog/services").header("Authorization", dana.bearer())
                        .header("X-Business-Id", GLOW_BEAUTY_ID))
                .andExpect(jsonPath("$.data.length()").value(8))
                .andExpect(jsonPath("$.data[0].slug").value("glow-cut"))
                .andExpect(jsonPath("$.data[0].staffIds.length()").value(2));

        String id = body(mvc.perform(post("/api/catalog/services").header("Authorization", dana.bearer())
                        .header("X-Business-Id", GLOW_BEAUTY_ID).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("name", "Brow Shaping", "category", "Make-up",
                                "durationMin", 30, "price", 7.5, "staffIds", List.of(DANA_MEMBER, LEAK),
                                "bookableOnline", true))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.slug").value("brow-shaping"))
                .andExpect(jsonPath("$.data.price").value(7.5))
                .andReturn()).path("data").path("id").asText();

        mvc.perform(get("/api/marketplace/items/brow-shaping"))
                .andExpect(jsonPath("$.data.type").value("SERVICE"))
                .andExpect(jsonPath("$.data.durationMin").value(30));

        mvc.perform(patch("/api/catalog/services/" + id).header("Authorization", dana.bearer())
                        .header("X-Business-Id", GLOW_BEAUTY_ID).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bookableOnline\":false,\"discountPct\":10}"))
                .andExpect(jsonPath("$.data.bookableOnline").value(false))
                .andExpect(jsonPath("$.data.discountPct").value(10))
                .andExpect(jsonPath("$.data.name").value("Brow Shaping"));
        mvc.perform(get("/api/marketplace/items/brow-shaping")).andExpect(status().isNotFound());

        // duplicate name, unknown staff, bad duration
        mvc.perform(post("/api/catalog/services").header("Authorization", dana.bearer())
                        .header("X-Business-Id", GLOW_BEAUTY_ID).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("name", "brow shaping", "category", "Make-up",
                                "durationMin", 30, "price", 7, "staffIds", List.of(LEAK), "bookableOnline", true))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error.details[0].field").value("name"));
        mvc.perform(post("/api/catalog/services").header("Authorization", dana.bearer())
                        .header("X-Business-Id", GLOW_BEAUTY_ID).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("name", "Lashes", "category", "Make-up",
                                "durationMin", 30, "price", 7, "staffIds",
                                List.of("33333333-3333-4333-8333-000000000103"), "bookableOnline", true))))
                .andExpect(jsonPath("$.status.code").value("MEMBER_NOT_FOUND"));
        mvc.perform(post("/api/catalog/services").header("Authorization", dana.bearer())
                        .header("X-Business-Id", GLOW_BEAUTY_ID).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("name", "Lashes", "category", "Make-up",
                                "durationMin", 31, "price", 7, "staffIds", List.of(LEAK), "bookableOnline", true))))
                .andExpect(jsonPath("$.error.details[0].field").value("durationMin"));

        mvc.perform(delete("/api/catalog/services/" + id).header("Authorization", dana.bearer())
                        .header("X-Business-Id", GLOW_BEAUTY_ID))
                .andExpect(status().isOk());
        mvc.perform(get("/api/catalog/services").header("Authorization", dana.bearer())
                        .header("X-Business-Id", GLOW_BEAUTY_ID))
                .andExpect(jsonPath("$.data.length()").value(8));

        // a product shop has no services
        Session nita = login(NITA, DEMO_PASSWORD);
        mvc.perform(get("/api/catalog/services").header("Authorization", nita.bearer())
                        .header("X-Business-Id", NITA_GADGET_ID))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status.code").value("WRONG_BUSINESS_TYPE"));
    }
}
