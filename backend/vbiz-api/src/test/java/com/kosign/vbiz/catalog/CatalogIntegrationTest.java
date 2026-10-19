package com.kosign.vbiz.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.support.IntegrationTest;

class CatalogIntegrationTest extends IntegrationTest {

    @Autowired
    JdbcTemplate jdbc;

    private MockHttpServletRequestBuilder as(Session s, MockHttpServletRequestBuilder b, String biz) {
        return b.header("Authorization", s.bearer()).header("X-Business-Id", biz);
    }

    private MockHttpServletRequestBuilder body(MockHttpServletRequestBuilder b, Object body) throws Exception {
        return b.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
    }

    static Map<String, Object> caseProduct(String title, String skuPrefix) {
        return Map.of(
                "title", title,
                "description", "Soft case",
                "collection", "Accessories",
                "status", "ACTIVE",
                "lowStockAt", 3,
                "options", List.of(Map.of("name", "Colour", "values", List.of("Black", "Red"))),
                "variants", List.of(
                        Map.of("id", "tmp-1", "options", Map.of("Colour", "Black"), "price", 12, "compareAt", 15,
                                "cost", 5, "sku", skuPrefix + "-BLK", "stock", 4, "swatch", "#000000"),
                        Map.of("id", "tmp-2", "options", Map.of("Colour", "Red"), "price", 12,
                                "sku", skuPrefix + "-RED", "stock", 0)),
                "specs", Map.of("Material", "Silicone", "Fits", "iPhone 15"));
    }

    @Test
    void seeded_products_and_collections() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        JsonNode list = body(mvc.perform(as(nita, get("/api/catalog/products"), NITA_GADGET_ID))
                .andExpect(status().isOk()).andReturn()).path("data");
        assertThat(list.size()).isGreaterThanOrEqualTo(8);
        JsonNode iphone = null;
        for (JsonNode p : list) {
            if (p.path("slug").asText().equals("nita-iphone15")) {
                iphone = p;
            }
        }
        assertThat(iphone).isNotNull();
        assertThat(iphone.path("collection").asText()).isEqualTo("Phones");
        assertThat(iphone.path("variants").size()).isEqualTo(6);
        assertThat(iphone.path("variants").get(0).path("options").path("Colour").asText()).isEqualTo("Black");
        assertThat(iphone.path("variants").get(0).path("cost").decimalValue()).isEqualByComparingTo("735");
        assertThat(iphone.path("variants").get(0).path("barcode").asText()).isEqualTo("885000000101");

        mvc.perform(as(nita, get("/api/catalog/collections"), NITA_GADGET_ID))
                .andExpect(jsonPath("$.data.length()").value(5))
                .andExpect(jsonPath("$.data[0].name").value("Phones"));
        // without X-Business-Id
        mvc.perform(get("/api/catalog/products").header("Authorization", nita.bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status.code").value("BUSINESS_CONTEXT_REQUIRED"));
        // another shop's header
        mvc.perform(as(nita, get("/api/catalog/products"), GLOW_BEAUTY_ID))
                .andExpect(jsonPath("$.status.code").value("FORBIDDEN_TENANT"));
        mvc.perform(get("/api/catalog/products")).andExpect(status().isUnauthorized());
    }

    @Test
    void create_update_duplicate_and_delete_a_product() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        String sku = "T" + UUID.randomUUID().toString().substring(0, 6);
        JsonNode created = body(mvc.perform(body(as(nita, post("/api/catalog/products"), NITA_GADGET_ID),
                        caseProduct("Leather Case Test", sku)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.collection").value("Accessories"))
                .andExpect(jsonPath("$.data.categoryId").value("electronics"))
                .andExpect(jsonPath("$.data.variants.length()").value(2))
                .andExpect(jsonPath("$.data.variants[0].stock").value(4))
                .andExpect(jsonPath("$.data.variants[1].stock").value(0))
                .andExpect(jsonPath("$.data.specs.Material").value("Silicone"))
                .andReturn()).path("data");
        String id = created.path("id").asText();
        String slug = created.path("slug").asText();
        assertThat(slug).startsWith("leather-case-test");
        String bc0 = created.path("variants").get(0).path("barcode").asText();
        String bc1 = created.path("variants").get(1).path("barcode").asText();
        assertThat(bc0).startsWith("885000000").isNotEqualTo(bc1);
        assertThat(Long.parseLong(bc0)).isGreaterThan(885000000118L);

        // opening stock is a movement
        mvc.perform(as(nita, get("/api/inventory/movements").param("productId", id), NITA_GADGET_ID))
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].reason").value("OPENING_STOCK"))
                .andExpect(jsonPath("$.data[0].delta").value(4))
                .andExpect(jsonPath("$.data[0].byName").value("Kry Sonita"));

        // the marketplace lists it
        mvc.perform(get("/api/marketplace/items/" + slug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.type").value("PRODUCT"))
                .andExpect(jsonPath("$.data.shopSlug").value("nita-gadget"))
                .andExpect(jsonPath("$.data.variants[0].stock").value(4))
                .andExpect(jsonPath("$.data.variants[0].cost").doesNotExist());

        // duplicate SKU (another product)
        mvc.perform(body(as(nita, post("/api/catalog/products"), NITA_GADGET_ID), caseProduct("Other", sku)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status.code").value("DUPLICATE_SKU"))
                .andExpect(jsonPath("$.error.details[0].field").value("variants[0].sku"));

        // update: keep Black (stock ignored), drop Red, add Blue with opening stock 2
        String black = created.path("variants").get(0).path("id").asText();
        Map<String, Object> upd = Map.of(
                "title", "Leather Case Test", "status", "DRAFT", "lowStockAt", 2, "collection", "Cases",
                "options", List.of(Map.of("name", "Colour", "values", List.of("Black", "Blue"))),
                "variants", List.of(
                        Map.of("id", black, "options", Map.of("Colour", "Black"), "price", 13, "sku", sku + "-BLK",
                                "barcode", bc0, "stock", 99),
                        Map.of("id", "new-1", "options", Map.of("Colour", "Blue"), "price", 13, "stock", 2)));
        JsonNode updated = body(mvc.perform(body(as(nita, put("/api/catalog/products/" + id), NITA_GADGET_ID), upd))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andExpect(jsonPath("$.data.collection").value("Cases"))
                .andExpect(jsonPath("$.data.variants.length()").value(2))
                .andExpect(jsonPath("$.data.variants[0].id").value(black))
                .andExpect(jsonPath("$.data.variants[0].stock").value(4))
                .andExpect(jsonPath("$.data.variants[0].price").value(13.0))
                .andExpect(jsonPath("$.data.variants[1].stock").value(2))
                .andReturn()).path("data");
        assertThat(updated.path("slug").asText()).isEqualTo(slug);
        mvc.perform(as(nita, get("/api/inventory/movements").param("productId", id), NITA_GADGET_ID))
                .andExpect(jsonPath("$.data[0].note").value("newVariant"));
        // a draft is not listed
        mvc.perform(get("/api/marketplace/items/" + slug))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status.code").value("LISTING_NOT_FOUND"));

        mvc.perform(body(as(nita, patch("/api/catalog/products/" + id + "/status"), NITA_GADGET_ID),
                        Map.of("status", "ACTIVE")))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));

        JsonNode copy = body(mvc.perform(as(nita, post("/api/catalog/products/" + id + "/duplicate"), NITA_GADGET_ID))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.title").value("Leather Case Test (copy)"))
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andExpect(jsonPath("$.data.variants[0].stock").value(0))
                .andExpect(jsonPath("$.data.variants[0].sku").value(""))
                .andReturn()).path("data");
        assertThat(copy.path("variants").get(0).path("barcode").asText()).isNotEqualTo(bc0);

        mvc.perform(as(nita, delete("/api/catalog/products/" + id), NITA_GADGET_ID)).andExpect(status().isOk());
        mvc.perform(as(nita, get("/api/catalog/products/" + id), NITA_GADGET_ID))
                .andExpect(jsonPath("$.status.code").value("PRODUCT_NOT_FOUND"));
        // its SKU is free again
        mvc.perform(body(as(nita, post("/api/catalog/products"), NITA_GADGET_ID), caseProduct("Reuse", sku)))
                .andExpect(status().isCreated());
    }

    @Test
    void validation_rules() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        Map<String, Object> missingCombo = Map.of("title", "Bad", "status", "ACTIVE",
                "options", List.of(Map.of("name", "Size", "values", List.of("S", "M"))),
                "variants", List.of(Map.of("options", Map.of("Size", "S"), "price", 5)));
        mvc.perform(body(as(nita, post("/api/catalog/products"), NITA_GADGET_ID), missingCombo))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.details[0].field").value("variants"));
        Map<String, Object> badCompare = Map.of("title", "Bad", "status", "ACTIVE",
                "variants", List.of(Map.of("options", Map.of(), "price", 5, "compareAt", 4)));
        mvc.perform(body(as(nita, post("/api/catalog/products"), NITA_GADGET_ID), badCompare))
                .andExpect(jsonPath("$.status.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.error.details[0].field").value("variants[0].compareAt"));
        Map<String, Object> taken = Map.of("title", "Bad", "status", "ACTIVE",
                "variants", List.of(Map.of("options", Map.of(), "price", 5, "barcode", "885000000101")));
        mvc.perform(body(as(nita, post("/api/catalog/products"), NITA_GADGET_ID), taken))
                .andExpect(jsonPath("$.status.code").value("DUPLICATE_BARCODE"));
    }

    @Test
    void staff_can_read_and_adjust_but_not_edit_products() throws Exception {
        String email = uniqueEmail("staff");
        Session staff = signUp("Counter Staff", email, "Str0ng!Pass");
        UUID userId = UUID.fromString(staff.user().path("id").asText());
        jdbc.update("INSERT INTO business_member (id, business_id, user_id, name, role) VALUES (?, ?, ?, ?, 'STAFF')",
                UUID.randomUUID(), UUID.fromString(NITA_GADGET_ID), userId, "Counter Staff");
        mvc.perform(as(staff, get("/api/catalog/products"), NITA_GADGET_ID)).andExpect(status().isOk());
        mvc.perform(body(as(staff, post("/api/catalog/products"), NITA_GADGET_ID), caseProduct("No", "NO")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status.code").value("FORBIDDEN"));
        mvc.perform(as(staff, get("/api/inventory/alerts"), NITA_GADGET_ID)).andExpect(status().isOk());
    }
}
