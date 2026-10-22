package com.kosign.vbiz.business;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.booking.BookingTestSupport;

/** Shops suggest marketplace categories; super-admins decide (docs/api/phase19-category-requests.md). */
class CategoryRequestIntegrationTest extends BookingTestSupport {

    private static final String ADMIN = "admin@virtualbiz.com";

    private JsonNode admin(Session s, String method, String path, Object body) throws Exception {
        var req = method.equals("GET") ? get(path) : post(path);
        req.header("Authorization", s.bearer());
        if (body != null) {
            req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        }
        return body(mvc.perform(req).andReturn());
    }

    @Test
    void a_suggestion_is_approved_as_a_new_category_and_the_shop_moves_into_it() throws Exception {
        Session dana = login(DANA, DEMO_PASSWORD);
        String was = jdbc.queryForObject("select category_id from business where id = ?::uuid", String.class,
                GLOW_BEAUTY_ID);
        String name = "Lash studio " + System.nanoTime() % 100000;
        JsonNode r = shop(dana, "POST", "/api/category-requests",
                Map.of("name", name, "note", "We only do lash extensions")).path("data");
        assertThat(r.path("status").asText()).isEqualTo("PENDING");
        assertThat(code(shop(dana, "POST", "/api/category-requests", Map.of("name", "Another one"))))
                .isEqualTo("CONFLICT");
        assertThat(code(shop(dana, "POST", "/api/category-requests", Map.of("name", "x")))).isEqualTo(
                "VALIDATION_FAILED");

        Session admin = login(ADMIN, DEMO_PASSWORD);
        JsonNode queue = admin(admin, "GET", "/api/admin/category-requests?size=100", null).path("data");
        assertThat(queue.toString()).contains(name);
        assertThat(admin(admin, "GET", "/api/admin/overview", null).path("data").path("queues")
                .path("categoryRequests").asLong()).isPositive();

        JsonNode done = admin(admin, "POST", "/api/admin/category-requests/" + r.path("id").asText() + "/approve",
                Map.of("nameKh", "ស្ទូឌីយោរោមភ្នែក", "icon", "sparkle")).path("data");
        assertThat(done.path("status").asText()).isEqualTo("APPROVED");
        String cat = done.path("categoryId").asText();
        assertThat(jdbc.queryForObject("select category_id from business where id = ?::uuid", String.class,
                GLOW_BEAUTY_ID)).isEqualTo(cat);
        assertThat(jdbc.queryForObject("select count(*) from notification where business_id = ?::uuid and kind = ?",
                Integer.class, GLOW_BEAUTY_ID, "CATEGORY_APPROVED")).isPositive();
        assertThat(code(admin(admin, "POST", "/api/admin/category-requests/" + r.path("id").asText() + "/approve",
                null))).isEqualTo("CONFLICT");

        // Put the demo shop back where it was.
        jdbc.update("update business set category_id = ? where id = ?::uuid", was, GLOW_BEAUTY_ID);
    }

    @Test
    void a_suggestion_is_mapped_or_declined_with_a_reason_the_shop_reads() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        assertThat(code(shop(nita, NITA_GADGET_ID, "POST", "/api/category-requests", Map.of("name", "Electronics"))))
                .isEqualTo("CONFLICT");
        JsonNode r = shop(nita, NITA_GADGET_ID, "POST", "/api/category-requests",
                Map.of("name", "Gadget repair " + System.nanoTime() % 100000)).path("data");
        Session admin = login(ADMIN, DEMO_PASSWORD);
        assertThat(code(admin(admin, "POST", "/api/admin/category-requests/" + r.path("id").asText() + "/reject",
                Map.of("reason", "x")))).isEqualTo("VALIDATION_FAILED");
        JsonNode no = admin(admin, "POST", "/api/admin/category-requests/" + r.path("id").asText() + "/reject",
                Map.of("reason", "Repairs are a service: open a service shop for them")).path("data");
        assertThat(no.path("status").asText()).isEqualTo("REJECTED");
        JsonNode mine = shop(nita, NITA_GADGET_ID, "GET", "/api/category-requests", null).path("data").path(0);
        assertThat(mine.path("decisionNote").asText()).startsWith("Repairs are a service");

        JsonNode again = shop(nita, NITA_GADGET_ID, "POST", "/api/category-requests",
                Map.of("name", "Phone cases " + System.nanoTime() % 100000)).path("data");
        JsonNode mapped = admin(admin, "POST", "/api/admin/category-requests/" + again.path("id").asText()
                + "/approve", Map.of("categoryId", "electronics", "moveShop", false)).path("data");
        assertThat(mapped.path("categoryId").asText()).isEqualTo("electronics");
        assertThat(code(admin(admin, "POST", "/api/admin/category-requests/" + again.path("id").asText()
                + "/approve", Map.of("categoryId", "beauty")))).isEqualTo("CONFLICT");
    }
}
