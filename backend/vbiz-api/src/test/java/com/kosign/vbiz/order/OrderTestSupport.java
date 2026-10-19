package com.kosign.vbiz.order;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.support.IntegrationTest;

/** Shared helpers for the cart / checkout / order integration tests. */
public abstract class OrderTestSupport extends IntegrationTest {

    /** Fresh Mart rice ($7.50 → $6.75), plenty of stock; Fresh Mart auto-accepts. */
    protected static final String RICE = "bbbbbbbb-0000-4000-8000-000010000000";
    /** Fresh Mart bell pepper $6. */
    protected static final String PEPPER = "bbbbbbbb-0000-4000-8000-000012000000";
    /** Happy Coffee croissant $1.80, stock 3 (auto-accept). */
    protected static final String CROISSANT = "bbbbbbbb-0000-4000-8000-000003000000";
    /** Nita Gadget Store cable $6 (Nita does not auto-accept). */
    protected static final String CABLE = "bbbbbbbb-0000-4000-8000-000018000000";
    /** Nita's Silicone Case Storm Blue: $12 (compare-at $15), stock 0. */
    protected static final String CASE_STORM = "bbbbbbbb-0000-4000-8000-000019000002";
    protected static final String FRESH_MART_ID = "22222222-2222-4222-8222-000000000014";

    @Autowired
    protected JdbcTemplate jdbc;

    protected int stockOf(String variantId) {
        return jdbc.queryForObject("select stock from product_variant where id = ?::uuid", Integer.class, variantId);
    }

    protected int movementSumMismatches() {
        return jdbc.queryForObject("""
                select count(*) from product_variant v
                where v.stock <> (select coalesce(sum(delta), 0) from stock_movement m where m.variant_id = v.id)""",
                Integer.class);
    }

    /** A new customer with one address in {@code district}; returns the session and the address id. */
    protected record Customer(Session session, String addressId) {
        public String bearer() {
            return session.bearer();
        }
    }

    protected Customer newCustomer(String district) throws Exception {
        Session s = signUp("Sok Dara", uniqueEmail("buyer"), "Bright#2026");
        JsonNode a = body(mvc.perform(postJson("/api/me/addresses", Map.of("label", "HOME", "name", "Sok Dara",
                "phone", uniquePhone(), "line", "#7, St. 163", "district", district))
                .header("Authorization", s.bearer())).andReturn()).path("data");
        return new Customer(s, a.path("id").asText());
    }

    protected static Map<String, Object> line(String variantId, int qty) {
        return Map.of("variantId", variantId, "qty", qty);
    }

    protected static Map<String, Object> checkout(String addressId, String pay, List<Map<String, Object>> lines) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("lines", new ArrayList<>(lines));
        m.put("method", "DELIVERY");
        m.put("addressId", addressId);
        m.put("paymentMethod", pay);
        return m;
    }

    protected JsonNode place(Customer c, Map<String, Object> body) throws Exception {
        return place(c, body, UUID.randomUUID().toString());
    }

    protected JsonNode place(Customer c, Map<String, Object> body, String key) throws Exception {
        return body(mvc.perform(post("/api/checkout").header("Authorization", c.bearer())
                .header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body))).andReturn());
    }

    protected JsonNode seller(Session s, String method, String path, Object body) throws Exception {
        var req = method.equals("GET") ? get(path) : post(path);
        req.header("Authorization", s.bearer()).header("X-Business-Id", NITA_GADGET_ID);
        if (body != null) {
            req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        }
        return body(mvc.perform(req).andReturn());
    }

    protected JsonNode customerGet(Customer c, String path) throws Exception {
        return body(mvc.perform(get(path).header("Authorization", c.bearer())).andReturn());
    }

    protected JsonNode customerPost(Customer c, String path, Object body) throws Exception {
        var req = post(path).header("Authorization", c.bearer());
        if (body != null) {
            req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        }
        return body(mvc.perform(req).andReturn());
    }

    /** Puts stock on a variant through the inventory API (as the shop owner). */
    protected void topUp(Session owner, String businessId, String variantId, int n) throws Exception {
        mvc.perform(postJson("/api/inventory/movements", Map.of("variantId", variantId, "delta", n,
                "reason", "RECEIVED")).header("Authorization", owner.bearer()).header("X-Business-Id", businessId));
    }
}
