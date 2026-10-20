package com.kosign.vbiz.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.order.OrderTestSupport;

/** Platform settings and categories in the console (docs/api/phase7-admin.md § Settings, § Categories). */
class PlatformSettingsIntegrationTest extends OrderTestSupport {

    private static final String ADMIN = "admin@virtualbiz.com";
    private static final String SUPPORT = "support@virtualbiz.com";

    private JsonNode call(Session s, String method, String path, Object body) throws Exception {
        var req = switch (method) {
            case "GET" -> get(path);
            case "PUT" -> put(path);
            case "PATCH" -> patch(path);
            default -> post(path);
        };
        if (s != null) {
            req.header("Authorization", s.bearer());
        }
        if (body != null) {
            req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        }
        return body(mvc.perform(req).andReturn());
    }

    private static String code(JsonNode r) {
        return r.path("status").path("code").asText();
    }

    @Test
    void a_super_admin_changes_the_settings_and_it_is_audited() throws Exception {
        JsonNode pub = call(null, "GET", "/api/meta/settings", null).path("data");
        assertThat(pub.path("khrPerUsd").asInt()).isBetween(1000, 10000);
        Map<String, Object> was = Map.of("commissionPct", pub.path("commissionPct").decimalValue(),
                "payoutDelayDays", pub.path("payoutDelayDays").asInt(), "khrPerUsd", pub.path("khrPerUsd").asInt());

        Session support = login(SUPPORT, DEMO_PASSWORD);
        assertThat(code(call(support, "GET", "/api/admin/settings", null))).isEqualTo("SUCCESS");
        assertThat(code(call(support, "PUT", "/api/admin/settings",
                Map.of("commissionPct", 6, "payoutDelayDays", 2, "khrPerUsd", 4050)))).isEqualTo("SUPER_ADMIN_ONLY");

        Session admin = login(ADMIN, DEMO_PASSWORD);
        assertThat(code(call(admin, "PUT", "/api/admin/settings",
                Map.of("commissionPct", 45, "payoutDelayDays", 2, "khrPerUsd", 4050)))).isEqualTo("VALIDATION_FAILED");
        JsonNode saved = call(admin, "PUT", "/api/admin/settings",
                Map.of("commissionPct", 6.5, "payoutDelayDays", 2, "khrPerUsd", 4050)).path("data");
        assertThat(saved.path("commissionPct").decimalValue()).isEqualByComparingTo("6.5");
        assertThat(saved.path("updatedBy").asText()).isNotBlank();
        assertThat(call(null, "GET", "/api/meta/settings", null).path("data").path("khrPerUsd").asInt()).isEqualTo(4050);

        JsonNode log = call(admin, "GET", "/api/admin/audit?targetType=SETTINGS", null).path("data").path("items");
        assertThat(log.get(0).path("action").asText()).isEqualTo("SETTINGS_UPDATED");
        assertThat(log.get(0).path("details").path("khrPerUsd").path("to").asInt()).isEqualTo(4050);

        assertThat(code(call(admin, "PUT", "/api/admin/settings", was))).isEqualTo("SUCCESS");
    }

    @Test
    void a_super_admin_adds_hides_and_reorders_categories() throws Exception {
        Session admin = login(ADMIN, DEMO_PASSWORD);
        Session support = login(SUPPORT, DEMO_PASSWORD);
        String name = "Bikes " + System.nanoTime();
        assertThat(code(call(support, "POST", "/api/admin/categories",
                Map.of("businessType", "PRODUCT", "name", name, "nameKh", "កង់")))).isEqualTo("SUPER_ADMIN_ONLY");

        JsonNode c = call(admin, "POST", "/api/admin/categories", Map.of("businessType", "PRODUCT", "name", name,
                "nameKh", "កង់", "icon", "grid", "tint", 3)).path("data");
        String id = c.path("id").asText();
        assertThat(id).startsWith("bikes-");
        assertThat(c.path("shops").asLong()).isZero();
        assertThat(code(call(admin, "POST", "/api/admin/categories",
                Map.of("businessType", "PRODUCT", "name", name, "nameKh", "កង់")))).isEqualTo("CONFLICT");

        // In the public marketplace list until hidden.
        assertThat(ids(call(null, "GET", "/api/meta/categories?marketplace=true", null))).contains(id);
        JsonNode hidden = call(admin, "PATCH", "/api/admin/categories/" + id, Map.of("inMarketplace", false)).path("data");
        assertThat(hidden.path("inMarketplace").asBoolean()).isFalse();
        assertThat(ids(call(null, "GET", "/api/meta/categories?marketplace=true", null))).doesNotContain(id);
        JsonNode pub = call(null, "GET", "/api/meta/categories", null).path("data");
        for (JsonNode x : pub) {
            if (x.path("id").asText().equals(id)) {
                assertThat(x.path("nameKh").asText()).isEqualTo("កង់");
            }
        }

        // Move it to the top.
        List<String> order = new ArrayList<>(ids(call(admin, "GET", "/api/admin/categories", null)));
        order.remove(id);
        order.add(0, id);
        assertThat(code(call(admin, "PUT", "/api/admin/categories/order", order.subList(1, order.size()))))
                .isEqualTo("VALIDATION_FAILED");
        assertThat(ids(call(admin, "PUT", "/api/admin/categories/order", order)).get(0)).isEqualTo(id);
    }

    @Test
    void the_overview_covers_the_chosen_period() throws Exception {
        Session admin = login(ADMIN, DEMO_PASSWORD);
        JsonNode week = call(admin, "GET", "/api/admin/overview?days=7", null).path("data");
        assertThat(week.path("rangeDays").asInt()).isEqualTo(7);
        assertThat(week.path("days").size()).isEqualTo(7);
        assertThat(week.path("categories").isArray()).isTrue();
        assertThat(call(admin, "GET", "/api/admin/overview?days=90", null).path("data").path("days").size())
                .isEqualTo(90);
        assertThat(code(call(admin, "GET", "/api/admin/overview?days=12", null))).isEqualTo("VALIDATION_FAILED");
    }

    private static List<String> ids(JsonNode r) {
        List<String> out = new ArrayList<>();
        r.path("data").forEach(x -> out.add(x.path("id").asText()));
        return out;
    }
}
