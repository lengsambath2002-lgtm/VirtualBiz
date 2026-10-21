package com.kosign.vbiz.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.order.OrderTestSupport;

/** Console lists: sort, date range, new filters, CSV export and bulk actions (docs/api/phase15-lists.md). */
class AdminListsIntegrationTest extends OrderTestSupport {

    private static final String ADMIN = "admin@virtualbiz.com";

    @Autowired
    JdbcTemplate jdbc;

    private JsonNode getJson(Session s, String path) throws Exception {
        return body(mvc.perform(get(path).header("Authorization", s.bearer())).andReturn());
    }

    private JsonNode postJson(Session s, String path, Object in) throws Exception {
        return body(mvc.perform(post(path).header("Authorization", s.bearer()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(in))).andReturn());
    }

    private static String code(JsonNode r) {
        return r.path("status").path("code").asText();
    }

    @Test
    void lists_sort_by_whitelisted_columns_only() throws Exception {
        Session admin = login(ADMIN, DEMO_PASSWORD);
        JsonNode byTotal = getJson(admin, "/api/admin/orders?sort=-total&size=10").path("data");
        List<BigDecimal> totals = new ArrayList<>();
        byTotal.path("items").forEach(o -> totals.add(o.path("total").decimalValue()));
        assertThat(totals).isNotEmpty().isSortedAccordingTo((a, b) -> b.compareTo(a));
        assertThat(byTotal.path("size").asInt()).isEqualTo(10);

        JsonNode byName = getJson(admin, "/api/admin/businesses?sort=name&size=100").path("data").path("items");
        List<String> names = new ArrayList<>();
        byName.forEach(b -> names.add(b.path("name").asText()));
        assertThat(names).isSortedAccordingTo(String.CASE_INSENSITIVE_ORDER);

        assertThat(code(getJson(admin, "/api/admin/orders?sort=o.total;drop"))).isEqualTo("VALIDATION_FAILED");
        assertThat(code(getJson(admin, "/api/admin/users?sort=password"))).isEqualTo("VALIDATION_FAILED");
    }

    @Test
    void date_ranges_and_new_filters_narrow_the_lists() throws Exception {
        Session admin = login(ADMIN, DEMO_PASSWORD);
        long all = getJson(admin, "/api/admin/orders").path("data").path("total").asLong();
        assertThat(getJson(admin, "/api/admin/orders?from=2001-01-01&to=2001-12-31").path("data").path("total")
                .asLong()).isZero();
        long pickup = getJson(admin, "/api/admin/orders?method=PICKUP").path("data").path("total").asLong();
        assertThat(pickup).isLessThan(all);
        getJson(admin, "/api/admin/orders?method=PICKUP").path("data").path("items")
                .forEach(o -> assertThat(o.path("method").asText()).isEqualTo("PICKUP"));
        assertThat(code(getJson(admin, "/api/admin/orders?from=2026-10-02&to=2026-10-01")))
                .isEqualTo("VALIDATION_FAILED");

        getJson(admin, "/api/admin/reviews?replied=no&size=100").path("data").path("items")
                .forEach(r -> assertThat(r.path("reply").isNull() || r.path("reply").isMissingNode()).isTrue());
        getJson(admin, "/api/admin/businesses?category=electronics&size=100").path("data").path("items")
                .forEach(b -> assertThat(b.path("categoryId").asText()).isEqualTo("electronics"));

        JsonNode promos = getJson(admin, "/api/admin/promotions?size=1").path("data");
        assertThat(promos.path("items").size()).isLessThanOrEqualTo(1);
        assertThat(promos.has("total")).isTrue();
        JsonNode balances = getJson(admin, "/api/admin/payouts/balances?due=payable").path("data");
        balances.path("items").forEach(b -> assertThat(b.path("payable").decimalValue()).isPositive());
    }

    @Test
    void an_export_is_the_filtered_list_as_csv_and_is_audited() throws Exception {
        Session admin = login(ADMIN, DEMO_PASSWORD);
        long pickup = getJson(admin, "/api/admin/orders?method=PICKUP").path("data").path("total").asLong();
        MockHttpServletResponse res = mvc.perform(get("/api/admin/orders/export?method=PICKUP&sort=-total")
                .header("Authorization", admin.bearer())).andReturn().getResponse();
        assertThat(res.getStatus()).isEqualTo(200);
        assertThat(res.getContentType()).startsWith("text/csv");
        assertThat(res.getHeader("Content-Disposition")).contains("virtualbiz-orders-");
        String csv = res.getContentAsString(StandardCharsets.UTF_8);
        assertThat(csv).startsWith("﻿\"Order\",\"Placed\"");
        assertThat(csv.split("\r\n")).hasSize((int) pickup + 1);
        assertThat(Long.parseLong(res.getHeader("X-Row-Count"))).isEqualTo(pickup);

        JsonNode audit = getJson(admin, "/api/admin/audit?targetType=EXPORT").path("data").path("items").path(0);
        assertThat(audit.path("action").asText()).isEqualTo("DATA_EXPORTED");
        assertThat(audit.path("targetId").asText()).isEqualTo("orders");
        assertThat(audit.path("details").path("method").asText()).isEqualTo("PICKUP");
        assertThat(audit.path("details").path("rows").asLong()).isEqualTo(pickup);

        for (String list : List.of("businesses", "users", "reviews", "payouts", "audit")) {
            assertThat(mvc.perform(get("/api/admin/" + list + "/export").header("Authorization", admin.bearer()))
                    .andReturn().getResponse().getStatus()).as(list).isEqualTo(200);
        }
        Session nita = login(NITA, DEMO_PASSWORD);
        assertThat(mvc.perform(get("/api/admin/orders/export").header("Authorization", nita.bearer())).andReturn()
                .getResponse().getStatus()).isEqualTo(403);
    }

    @Test
    void a_bulk_action_runs_each_row_and_reports_the_ones_it_refused() throws Exception {
        Session admin = login(ADMIN, DEMO_PASSWORD);
        JsonNode visible = getJson(admin, "/api/admin/reviews?status=visible&size=2").path("data").path("items");
        String a = visible.path(0).path("id").asText();
        String b = visible.path(1).path("id").asText();
        String unknown = "99999999-9999-4999-8999-999999999999";

        JsonNode r = postJson(admin, "/api/admin/reviews/bulk",
                Map.of("ids", List.of(a, b, unknown), "action", "hide", "reason", "Spam from one account"))
                .path("data");
        assertThat(r.path("done").asInt()).isEqualTo(2);
        assertThat(r.path("failed").size()).isEqualTo(1);
        assertThat(r.path("failed").path(0).path("id").asText()).isEqualTo(unknown);
        assertThat(jdbc.queryForObject("select count(*) from admin_audit where action = 'REVIEW_HIDDEN'"
                + " and target_id in (?, ?)", Integer.class, a, b)).isEqualTo(2);

        assertThat(code(postJson(admin, "/api/admin/reviews/bulk", Map.of("ids", List.of(a), "action", "hide"))))
                .isEqualTo("VALIDATION_FAILED");
        assertThat(code(postJson(admin, "/api/admin/reviews/bulk", Map.of("ids", List.of(a), "action", "delete"))))
                .isEqualTo("VALIDATION_FAILED");
        assertThat(postJson(admin, "/api/admin/reviews/bulk", Map.of("ids", List.of(a, b), "action", "restore"))
                .path("data").path("done").asInt()).isEqualTo(2);
    }
}
