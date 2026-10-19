package com.kosign.vbiz.marketplace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.support.IntegrationTest;

class MarketplaceIntegrationTest extends IntegrationTest {

    private JsonNode data(String path, String... params) throws Exception {
        var req = get(path);
        for (int i = 0; i < params.length; i += 2) {
            req = req.param(params[i], params[i + 1]);
        }
        return body(mvc.perform(req).andExpect(status().isOk()).andReturn()).path("data");
    }

    private static List<String> slugs(JsonNode arr) {
        List<String> out = new ArrayList<>();
        arr.forEach(n -> out.add(n.path("slug").asText()));
        return out;
    }

    @Test
    void reference_data_is_public() throws Exception {
        mvc.perform(get("/api/meta/districts"))
                .andExpect(jsonPath("$.data.length()").value(10))
                .andExpect(jsonPath("$.data[0].id").value("toul-kork"))
                .andExpect(jsonPath("$.data[0].lat").value(11.5833));
        mvc.perform(get("/api/meta/categories").param("marketplace", "true"))
                .andExpect(jsonPath("$.data.length()").value(8));
        mvc.perform(get("/api/meta/categories").param("type", "SERVICE"))
                .andExpect(jsonPath("$.data.length()").value(6));
    }

    @Test
    void shops_items_and_details() throws Exception {
        JsonNode shops = data("/api/marketplace/shops");
        assertThat(slugs(shops)).contains("happy-coffee", "glow-beauty", "nita-gadget", "jasmine-spa")
                .doesNotContain("happy-coffee-2");
        JsonNode jasmine = data("/api/marketplace/shops/jasmine-spa");
        assertThat(jasmine.path("icon").asText()).isEqualTo("leaf");
        assertThat(jasmine.path("tint").asInt()).isEqualTo(3);
        assertThat(jasmine.path("replyMinutes").asInt()).isEqualTo(20);
        assertThat(jasmine.path("staff").size()).isEqualTo(3); // the placeholder owner performs nothing
        assertThat(jasmine.path("bookingSettings").path("autoConfirm").asBoolean()).isTrue();
        JsonNode coffee = data("/api/marketplace/shops/happy-coffee");
        assertThat(coffee.path("etaMinutes").get(0).asInt()).isEqualTo(20);
        assertThat(coffee.path("productSettings").path("zones").size()).isEqualTo(3);

        JsonNode latte = data("/api/marketplace/items/latte");
        assertThat(latte.path("type").asText()).isEqualTo("PRODUCT");
        assertThat(latte.path("variants").size()).isEqualTo(9);
        assertThat(latte.path("variants").get(0).path("price").decimalValue()).isEqualByComparingTo("2.00");
        assertThat(latte.path("variants").get(0).path("compareAt").decimalValue()).isEqualByComparingTo("2.50");
        assertThat(latte.path("specs").path("Caffeine").asText()).startsWith("~150");
        assertThat(latte.path("options").get(0).path("name").asText()).isEqualTo("Size");

        JsonNode massage = data("/api/marketplace/items/massage");
        assertThat(massage.path("type").asText()).isEqualTo("SERVICE");
        assertThat(massage.path("discountPct").asInt()).isEqualTo(20);
        assertThat(massage.path("staffIds").size()).isEqualTo(3);

        assertThat(data("/api/marketplace/items", "shop", "happy-coffee").size()).isEqualTo(3);
        assertThat(data("/api/marketplace/items", "type", "service").findValuesAsText("type"))
                .containsOnly("SERVICE");
        // draft and hidden listings are not listed
        assertThat(slugs(data("/api/marketplace/items"))).doesNotContain("nita-glass", "glow-kera");

        JsonNode reviews = data("/api/marketplace/items/latte/reviews");
        assertThat(reviews.size()).isEqualTo(3);
        assertThat(reviews.get(0).path("itemSlug").asText()).isEqualTo("latte");
        JsonNode shopReviews = data("/api/marketplace/shops/nita-gadget/reviews");
        assertThat(shopReviews.findValuesAsText("authorName")).contains("Chan Mithona");

        mvc.perform(get("/api/marketplace/items/nope")).andExpect(jsonPath("$.status.code").value("LISTING_NOT_FOUND"));
        mvc.perform(get("/api/marketplace/shops/nope")).andExpect(jsonPath("$.status.code").value("BUSINESS_NOT_FOUND"));
    }

    @Test
    void search_filters_and_sorts() throws Exception {
        assertThat(slugs(data("/api/marketplace/search", "q", "latte").path("items"))).containsExactly("latte");
        // shop-name and category matches
        assertThat(slugs(data("/api/marketplace/search", "q", "happy coffee").path("items")))
                .containsExactlyInAnyOrder("latte", "coldbrew", "croissant");
        assertThat(slugs(data("/api/marketplace/search", "q", "spa").path("shops"))).contains("jasmine-spa");

        JsonNode services = data("/api/marketplace/search", "type", "service", "category", "spa,salon");
        assertThat(slugs(services.path("items"))).containsExactlyInAnyOrder("massage", "khmer", "footspa",
                "haircut", "shave");
        assertThat(services.path("shops").findValuesAsText("type")).containsOnly("SERVICE");

        JsonNode cheap = data("/api/marketplace/search", "type", "product", "max", "3", "sort", "low");
        List<Double> prices = new ArrayList<>();
        cheap.path("items").forEach(i -> prices.add(i.path("variants").get(0).path("price").asDouble()));
        assertThat(prices).isNotEmpty().isSorted().allMatch(p -> p <= 3);

        JsonNode sale = data("/api/marketplace/search", "sale", "1");
        sale.path("items").forEach(i -> assertThat(i.path("type").asText().equals("SERVICE")
                ? i.path("discountPct").asInt() > 0
                : i.path("variants").get(0).has("compareAt")).isTrue());

        JsonNode rated = data("/api/marketplace/search", "rating", "4.9");
        rated.path("items").forEach(i -> assertThat(i.path("rating").asDouble()).isGreaterThanOrEqualTo(4.9));

        // nearest to Sen Sok: Sambath Barber is in Sen Sok
        JsonNode near = data("/api/marketplace/search", "sort", "near", "district", "Sen Sok");
        assertThat(near.path("items").get(0).path("shopSlug").asText()).isEqualTo("sambath-barber");
        assertThat(near.path("shops").get(0).path("slug").asText()).isEqualTo("sambath-barber");
        assertThat(near.path("shops").get(0).path("distanceKm").asDouble()).isLessThan(1.0);
        // an exact point next to Fresh Mart
        JsonNode point = data("/api/marketplace/search", "sort", "near", "lat", "11.548", "lng", "104.929",
                "type", "product");
        assertThat(point.path("items").get(0).path("shopSlug").asText()).isEqualTo("fresh-mart");

        // free / low delivery to BKK1: only zone-1 product shops
        JsonNode free = data("/api/marketplace/search", "freeDel", "1", "district", "BKK1");
        assertThat(free.path("items").findValuesAsText("type")).containsOnly("PRODUCT");
        assertThat(data("/api/marketplace/search", "freeDel", "1", "district", "Por Senchey").path("items").size())
                .isZero();

        // best = sold × rating: rice (3200 × 4.8) first
        assertThat(data("/api/marketplace/search").path("items").get(0).path("slug").asText()).isEqualTo("rice");
        // LIKE wildcards are literal
        assertThat(data("/api/marketplace/search", "q", "%").path("items").size()).isZero();
    }

    @Test
    void deals_and_platform_codes() throws Exception {
        JsonNode deals = data("/api/marketplace/deals");
        assertThat(deals.findValuesAsText("shopSlug")).contains("happy-coffee", "jasmine-spa", "glow-beauty");
        assertThat(deals.findValuesAsText("title")).doesNotContain("Back-to-school haircut", "Water Festival colour week");
        JsonNode promos = data("/api/marketplace/promotions");
        assertThat(promos.findValuesAsText("code")).containsExactlyInAnyOrder("WATERFEST", "NEW5");
        assertThat(promos.get(0).has("businessId")).isTrue();
    }

    @Test
    void saved_items_and_followed_shops() throws Exception {
        Session s = signUp("Saver", uniqueEmail("saver"), "Str0ng!Pass");
        mvc.perform(get("/api/me/saved")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me/saved").header("Authorization", s.bearer())).andExpect(jsonPath("$.data.length()").value(0));
        mvc.perform(put("/api/me/saved/latte").header("Authorization", s.bearer()))
                .andExpect(jsonPath("$.data[0].key").value("latte"))
                .andExpect(jsonPath("$.data[0].type").value("PRODUCT"));
        mvc.perform(put("/api/me/saved/massage").header("Authorization", s.bearer())).andExpect(status().isOk());
        mvc.perform(put("/api/me/saved/shop:happy-coffee").header("Authorization", s.bearer()))
                .andExpect(jsonPath("$.data.length()").value(3))
                .andExpect(jsonPath("$.data[0].key").value("shop:happy-coffee"))
                .andExpect(jsonPath("$.data[0].type").value("SHOP"));
        // idempotent
        mvc.perform(put("/api/me/saved/latte").header("Authorization", s.bearer()))
                .andExpect(jsonPath("$.data.length()").value(3));
        mvc.perform(delete("/api/me/saved/latte").header("Authorization", s.bearer()))
                .andExpect(jsonPath("$.data.length()").value(2));
        mvc.perform(delete("/api/me/saved/latte").header("Authorization", s.bearer()))
                .andExpect(jsonPath("$.data.length()").value(2));
        mvc.perform(put("/api/me/saved/nope").header("Authorization", s.bearer()))
                .andExpect(jsonPath("$.status.code").value("LISTING_NOT_FOUND"));
        mvc.perform(put("/api/me/saved/shop:nope").header("Authorization", s.bearer()))
                .andExpect(jsonPath("$.status.code").value("BUSINESS_NOT_FOUND"));
        // another user sees nothing
        Session other = signUp("Other", uniqueEmail("other"), "Str0ng!Pass");
        mvc.perform(get("/api/me/saved").header("Authorization", other.bearer()))
                .andExpect(jsonPath("$.data.length()").value(0));
    }
}
