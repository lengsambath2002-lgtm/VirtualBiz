package com.kosign.vbiz.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.support.IntegrationTest;

/** Collections and service categories the owner manages (docs/api/phase12-catalog-structure.md). */
class CatalogStructureIntegrationTest extends IntegrationTest {

    private JsonNode call(Session s, String businessId, String method, String path, Object body) throws Exception {
        var req = switch (method) {
            case "GET" -> get(path);
            case "PATCH" -> patch(path);
            case "PUT" -> put(path);
            case "DELETE" -> delete(path);
            default -> post(path);
        };
        req.header("Authorization", s.bearer()).header("X-Business-Id", businessId);
        if (body != null) {
            req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        }
        return body(mvc.perform(req).andReturn());
    }

    private static String code(JsonNode r) {
        return r.path("status").path("code").asText();
    }

    private static String idOf(JsonNode list, String name) {
        for (JsonNode c : list) {
            if (c.path("name").asText().equals(name)) {
                return c.path("id").asText();
            }
        }
        return null;
    }

    @Test
    void the_owner_creates_renames_reorders_and_deletes_collections() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        String a = "Chargers " + UUID.randomUUID().toString().substring(0, 4);
        String b = "Cables " + UUID.randomUUID().toString().substring(0, 4);
        JsonNode list = call(nita, NITA_GADGET_ID, "POST", "/api/catalog/collections", Map.of("name", a)).path("data");
        list = call(nita, NITA_GADGET_ID, "POST", "/api/catalog/collections", Map.of("name", b)).path("data");
        String aId = idOf(list, a);
        String bId = idOf(list, b);
        assertThat(code(call(nita, NITA_GADGET_ID, "POST", "/api/catalog/collections", Map.of("name", a.toUpperCase()))))
                .isEqualTo("CONFLICT");
        assertThat(code(call(nita, NITA_GADGET_ID, "POST", "/api/catalog/collections", Map.of("name", "x"))))
                .isEqualTo("VALIDATION_FAILED");

        list = call(nita, NITA_GADGET_ID, "PATCH", "/api/catalog/collections/" + aId, Map.of("name", a + " fast"))
                .path("data");
        assertThat(idOf(list, a + " fast")).isEqualTo(aId);

        // Move A to the top.
        List<String> order = new ArrayList<>();
        list.forEach(c -> order.add(c.path("id").asText()));
        order.remove(aId);
        order.add(0, aId);
        list = call(nita, NITA_GADGET_ID, "PUT", "/api/catalog/collections/order", order).path("data");
        assertThat(list.get(0).path("id").asText()).isEqualTo(aId);

        // A product in A moves to B when A is deleted.
        String sku = "COL-" + UUID.randomUUID().toString().substring(0, 6);
        JsonNode product = call(nita, NITA_GADGET_ID, "POST", "/api/catalog/products", Map.of(
                "title", "Fast Charger " + sku, "status", "ACTIVE", "lowStockAt", 2, "collection", a + " fast",
                "options", List.of(), "variants", List.of(Map.of("id", "new-1", "options", Map.of(), "price", 9,
                        "sku", sku, "stock", 0)))).path("data");
        assertThat(product.path("collection").asText()).isEqualTo(a + " fast");
        list = call(nita, NITA_GADGET_ID, "DELETE", "/api/catalog/collections/" + aId + "?moveTo=" + bId, null)
                .path("data");
        assertThat(idOf(list, a + " fast")).isNull();
        for (JsonNode c : list) {
            if (c.path("id").asText().equals(bId)) {
                assertThat(c.path("productCount").asLong()).isEqualTo(1);
            }
        }
        JsonNode moved = call(nita, NITA_GADGET_ID, "GET", "/api/catalog/products/" + product.path("id").asText(), null)
                .path("data");
        assertThat(moved.path("collection").asText()).isEqualTo(b);
    }

    @Test
    void a_new_shop_starts_with_collections_for_its_category() throws Exception {
        Session owner = signUp("Cafe Owner", uniqueEmail("cafe"), "Bright#2026");
        JsonNode biz = body(mvc.perform(post("/api/businesses").header("Authorization", owner.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
                        "type", "PRODUCT", "name", "Morning Brew " + UUID.randomUUID().toString().substring(0, 4),
                        "categoryId", "cafe", "district", "Toul Kork", "street", "#12, St. 516",
                        "phone", uniquePhone(),
                        "hours", Map.of("open", "07:00", "close", "18:00", "sunday", true))))).andReturn())
                .path("data");
        String id = biz.path("id").asText();
        assertThat(id).isNotBlank();
        Session again = login(owner.user().path("email").asText(), "Bright#2026");
        JsonNode list = call(again, id, "GET", "/api/catalog/collections", null).path("data");
        assertThat(idOf(list, "Coffee")).isNotNull();
        assertThat(idOf(list, "Phones")).isNull();
    }

    @Test
    void a_provider_renames_a_service_category_and_its_services_follow() throws Exception {
        Session dana = login(DANA, DEMO_PASSWORD);
        String path = "/api/businesses/" + GLOW_BEAUTY_ID;
        JsonNode bs = call(dana, GLOW_BEAUTY_ID, "GET", path, null).path("data").path("bookingSettings");
        List<String> cats = new ArrayList<>();
        bs.path("serviceCategories").forEach(c -> cats.add(c.asText()));
        assertThat(cats).contains("Hair", "Nails");

        // A service in a new category adds it to the list.
        String name = "Lash Lift " + UUID.randomUUID().toString().substring(0, 4);
        JsonNode members = call(dana, GLOW_BEAUTY_ID, "GET", path + "/members", null).path("data");
        String staff = members.get(0).path("id").asText();
        JsonNode svc = call(dana, GLOW_BEAUTY_ID, "POST", "/api/catalog/services", Map.of("name", name,
                "category", "Lashes", "durationMin", 45, "price", 20, "staffIds", List.of(staff),
                "bookableOnline", false)).path("data");
        assertThat(svc.path("category").asText()).isEqualTo("Lashes");
        JsonNode after = call(dana, GLOW_BEAUTY_ID, "GET", path, null).path("data").path("bookingSettings")
                .path("serviceCategories");
        assertThat(after.toString()).contains("Lashes");

        JsonNode renamed = call(dana, GLOW_BEAUTY_ID, "POST", "/api/catalog/services/categories/rename",
                Map.of("from", "Lashes", "to", "Lashes & brows")).path("data");
        assertThat(renamed.toString()).contains("Lashes & brows").doesNotContain("\"Lashes\"");
        JsonNode list = call(dana, GLOW_BEAUTY_ID, "GET", "/api/catalog/services", null).path("data");
        for (JsonNode s : list) {
            if (s.path("name").asText().equals(name)) {
                assertThat(s.path("category").asText()).isEqualTo("Lashes & brows");
            }
        }
        assertThat(code(call(dana, GLOW_BEAUTY_ID, "PATCH", path,
                Map.of("bookingSettings", Map.of("serviceCategories", List.of("Hair", "hair")))))).isEqualTo("VALIDATION_FAILED");
        call(dana, GLOW_BEAUTY_ID, "DELETE", "/api/catalog/services/" + svc.path("id").asText(), null);
    }
}
