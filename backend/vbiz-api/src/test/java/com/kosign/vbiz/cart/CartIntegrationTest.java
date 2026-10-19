package com.kosign.vbiz.cart;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.support.IntegrationTest;

class CartIntegrationTest extends IntegrationTest {

    private static final String LATTE_16_NORMAL = "bbbbbbbb-0000-4000-8000-000001000005";
    private static final String COLDBREW = "bbbbbbbb-0000-4000-8000-000002000000";
    private static final String KRAMA_BLUE = "bbbbbbbb-0000-4000-8000-000008000001";
    private static final String STORM_CASE = "bbbbbbbb-0000-4000-8000-000019000002";

    private JsonNode putCart(Session s, Object body) throws Exception {
        return body(mvc.perform(put("/api/me/cart").header("Authorization", s.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andReturn());
    }

    @Test
    void replace_get_and_drop_unknown_variants() throws Exception {
        Session s = signUp("Cart User", uniqueEmail("cart"), "Bright#2026");
        mvc.perform(get("/api/me/cart")).andExpect(status().isUnauthorized());
        JsonNode cart = putCart(s, Map.of(
                "lines", List.of(
                        Map.of("variantId", LATTE_16_NORMAL, "qty", 2, "selected", false),
                        Map.of("variantId", UUID.randomUUID().toString(), "qty", 1),
                        Map.of("variantId", COLDBREW, "qty", 1),
                        Map.of("variantId", COLDBREW, "qty", 2)),
                "later", List.of(Map.of("variantId", KRAMA_BLUE, "qty", 1)))).path("data");
        assertThat(cart.path("lines").size()).isEqualTo(2);
        JsonNode latte = cart.path("lines").get(0);
        assertThat(latte.path("productSlug").asText()).isEqualTo("latte");
        assertThat(latte.path("shopSlug").asText()).isEqualTo("happy-coffee");
        assertThat(latte.path("options").path("Size").asText()).isNotBlank();
        assertThat(latte.path("selected").asBoolean()).isFalse();
        assertThat(cart.path("lines").get(1).path("qty").asInt()).isEqualTo(3);
        assertThat(cart.path("later").get(0).path("productSlug").asText()).isEqualTo("krama");
        JsonNode again = body(mvc.perform(get("/api/me/cart").header("Authorization", s.bearer())).andReturn())
                .path("data");
        assertThat(again).isEqualTo(cart);
        assertThat(putCart(s, Map.of("lines", List.of(Map.of("variantId", COLDBREW, "qty", 0))))
                .path("status").path("code").asText()).isEqualTo("VALIDATION_FAILED");
    }

    @Test
    void merge_adds_the_guest_cart_capped_at_stock() throws Exception {
        Session s = signUp("Cart Merge", uniqueEmail("merge"), "Bright#2026");
        putCart(s, Map.of("lines", List.of(Map.of("variantId", COLDBREW, "qty", 1, "selected", false))));
        JsonNode merged = body(mvc.perform(postJson("/api/me/cart/merge", Map.of(
                "lines", List.of(Map.of("variantId", COLDBREW, "qty", 2), Map.of("variantId", STORM_CASE, "qty", 1),
                        Map.of("variantId", KRAMA_BLUE, "qty", 500)),
                "later", List.of(Map.of("variantId", LATTE_16_NORMAL, "qty", 1))))
                .header("Authorization", s.bearer())).andReturn()).path("data");
        JsonNode lines = merged.path("lines");
        assertThat(lines.get(0).path("variantId").asText()).isEqualTo(COLDBREW);
        assertThat(lines.get(0).path("qty").asInt()).isEqualTo(3);
        assertThat(lines.get(0).path("selected").asBoolean()).isTrue();
        // Out of stock: kept at 1; more than the stock: capped at the stock.
        assertThat(lines.get(1).path("qty").asInt()).isEqualTo(1);
        assertThat(lines.get(2).path("qty").asInt()).isLessThanOrEqualTo(10);
        assertThat(merged.path("later").get(0).path("variantId").asText()).isEqualTo(LATTE_16_NORMAL);
    }
}
