package com.kosign.vbiz.report;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.booking.BookingTestSupport;

/** Shop lists: order history, filtered export, imports and the customer page (docs/api/phase16-shop-lists.md). */
class ShopListsIntegrationTest extends BookingTestSupport {

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void the_order_history_reaches_every_order_with_filters_sort_and_pages() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        long all = jdbc.queryForObject("select count(*) from orders where business_id = ?::uuid and placed_at is not null",
                Long.class, NITA_GADGET_ID);
        JsonNode page = shop(nita, NITA_GADGET_ID, "GET", "/api/orders/history?size=5&page=1", null).path("data");
        assertThat(page.path("total").asLong()).isEqualTo(all);
        assertThat(page.path("items").size()).isEqualTo(5);
        assertThat(page.path("page").asInt()).isEqualTo(1);

        JsonNode byTotal = shop(nita, NITA_GADGET_ID, "GET", "/api/orders/history?sort=-total&size=20", null)
                .path("data").path("items");
        List<BigDecimal> totals = new ArrayList<>();
        byTotal.forEach(o -> totals.add(o.path("total").decimalValue()));
        assertThat(totals).isSortedAccordingTo((a, b) -> b.compareTo(a));

        JsonNode pickup = shop(nita, NITA_GADGET_ID, "GET", "/api/orders/history?method=PICKUP&tab=done", null)
                .path("data");
        pickup.path("items").forEach(o -> assertThat(o.path("method").asText()).isEqualTo("PICKUP"));
        assertThat(shop(nita, NITA_GADGET_ID, "GET", "/api/orders/history?from=2001-01-01&to=2001-01-31", null)
                .path("data").path("total").asLong()).isZero();
        String number = byTotal.path(0).path("number").asText();
        assertThat(shop(nita, NITA_GADGET_ID, "GET", "/api/orders/history?q=" + number, null).path("data")
                .path("items").path(0).path("number").asText()).isEqualTo(number);
        assertThat(code(shop(nita, NITA_GADGET_ID, "GET", "/api/orders/history?sort=customer_secret", null)))
                .isEqualTo("VALIDATION_FAILED");

        String csv = mvc.perform(get("/api/exports/orders?method=PICKUP&tab=done&from=2026-01-01&to=2026-12-31")
                .header("Authorization", nita.bearer()).header("X-Business-Id", NITA_GADGET_ID)).andReturn()
                .getResponse().getContentAsString(StandardCharsets.UTF_8);
        for (String line : csv.trim().split("\r\n")) {
            if (!line.startsWith("﻿")) {
                assertThat(line).contains("\"PICKUP\"");
            }
        }
    }

    @Test
    void a_product_csv_checks_first_then_updates_by_sku_and_creates_new_products() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        Map<String, Object> v = jdbc.queryForMap("""
                select v.id, v.sku, v.stock from product_variant v join product p on p.id = v.product_id
                 where v.business_id = ?::uuid and v.deleted_at is null and p.deleted_at is null and v.sku <> ''
                 order by v.sku limit 1""", NITA_GADGET_ID);
        String sku = (String) v.get("sku");
        int stock = ((Number) v.get("stock")).intValue();
        String newSku = "IMP-" + System.nanoTime() % 1_000_000;
        List<Map<String, String>> rows = List.of(
                Map.of("SKU", sku, "Price (USD)", "19.90", "Stock", String.valueOf(stock + 3)),
                Map.of("Product", "Imported Cable " + newSku, "SKU", newSku, "Price (USD)", "4.50", "Stock", "12",
                        "Collection", "Accessories"),
                Map.of("Product", "Bad", "SKU", newSku, "Price (USD)", "abc"),
                Map.of("SKU", "NOPE-" + newSku, "Variant", "Red"));

        JsonNode dry = shop(nita, NITA_GADGET_ID, "POST", "/api/imports/products", Map.of("rows", rows)).path("data");
        assertThat(dry.path("applied").asBoolean()).isFalse();
        assertThat(dry.path("updated").asInt()).isEqualTo(1);
        assertThat(dry.path("created").asInt()).isEqualTo(1);
        List<String> fields = new ArrayList<>();
        dry.path("errors").forEach(e -> fields.add(e.path("line").asInt() + ":" + e.path("field").asText()));
        assertThat(fields).contains("4:SKU", "4:Price (USD)", "5:Variant");

        // With problems and no skipInvalid, nothing is written.
        JsonNode refused = shop(nita, NITA_GADGET_ID, "POST", "/api/imports/products?dryRun=false",
                Map.of("rows", rows)).path("data");
        assertThat(refused.path("applied").asBoolean()).isFalse();
        assertThat(jdbc.queryForObject("select count(*) from product_variant where sku = ?", Integer.class, newSku))
                .isZero();

        JsonNode done = shop(nita, NITA_GADGET_ID, "POST", "/api/imports/products?dryRun=false&skipInvalid=true",
                Map.of("rows", rows)).path("data");
        assertThat(done.path("applied").asBoolean()).isTrue();
        assertThat(jdbc.queryForObject("select price from product_variant where id = ?", BigDecimal.class,
                v.get("id"))).isEqualByComparingTo("19.90");
        assertThat(jdbc.queryForObject("select stock from product_variant where id = ?", Integer.class, v.get("id")))
                .isEqualTo(stock + 3);
        assertThat(jdbc.queryForObject("""
                select count(*) from stock_movement where variant_id = ? and reason = 'COUNT_CORRECTION'
                   and note = 'CSV import' and delta = 3""", Integer.class, v.get("id"))).isEqualTo(1);
        assertThat(jdbc.queryForObject("select stock from product_variant where sku = ?", Integer.class, newSku))
                .isEqualTo(12);
    }

    @Test
    void a_customer_csv_adds_and_updates_by_phone_and_the_page_has_lifetime_numbers() throws Exception {
        Session dana = login(DANA, DEMO_PASSWORD);
        String phone = uniquePhone();
        List<Map<String, String>> rows = List.of(
                Map.of("Name", "Mealea Import", "Phone", phone, "District", "Daun Penh", "Note", "Imported"),
                Map.of("Name", "X", "Phone", "123"),
                Map.of("Name", "Mealea Again", "Phone", phone));
        JsonNode r = shop(dana, "POST", "/api/imports/customers?dryRun=false&skipInvalid=true", Map.of("rows", rows))
                .path("data");
        assertThat(r.path("created").asInt()).isEqualTo(1);
        assertThat(r.path("errors").size()).isGreaterThanOrEqualTo(2);
        assertThat(jdbc.queryForObject("select district from client where business_id = ?::uuid and phone = ?",
                String.class, GLOW_BEAUTY_ID, phone)).isEqualTo("Daun Penh");

        JsonNode update = shop(dana, "POST", "/api/imports/customers?dryRun=false",
                Map.of("rows", List.of(Map.of("Name", "Mealea Renamed", "Phone", phone)))).path("data");
        assertThat(update.path("updated").asInt()).isEqualTo(1);

        JsonNode page = shop(dana, "GET", "/api/clients/page?q=" + phone, null).path("data");
        assertThat(page.path("total").asLong()).isEqualTo(1);
        JsonNode row = page.path("items").path(0);
        assertThat(row.path("name").asText()).isEqualTo("Mealea Renamed");
        assertThat(row.path("note").asText()).isEqualTo("Imported");
        assertThat(row.path("segment").asText()).isEqualTo("new");

        JsonNode bySpend = shop(dana, "GET", "/api/clients/page?sort=-spent&size=5", null).path("data").path("items");
        assertThat(bySpend.path(0).path("spent").decimalValue()).isPositive();
        assertThat(bySpend.path(0).path("segment").asText()).isEqualTo("vip");
        assertThat(bySpend.path(0).path("visits").asLong()).isPositive();

        Session nita = login(NITA, DEMO_PASSWORD);
        JsonNode buyers = shop(nita, NITA_GADGET_ID, "GET", "/api/clients/page?sort=-orders&size=1", null).path("data");
        assertThat(buyers.path("items").path(0).path("orders").asLong()).isPositive();
    }

    @Test
    void sale_history_and_the_appointment_list_page_and_filter() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        JsonNode receipts = shop(nita, NITA_GADGET_ID, "GET", "/api/pos/sales/history?size=3&sort=-total", null)
                .path("data");
        assertThat(receipts.path("total").asLong()).isPositive();
        assertThat(receipts.path("items").size()).isLessThanOrEqualTo(3);
        receipts.path("items").forEach(r -> assertThat(r.path("number").asText()).startsWith("R-"));
        String n = receipts.path("items").path(0).path("number").asText();
        assertThat(shop(nita, NITA_GADGET_ID, "GET", "/api/pos/sales/history?q=" + n, null).path("data")
                .path("items").path(0).path("number").asText()).isEqualTo(n);
        shop(nita, NITA_GADGET_ID, "GET", "/api/pos/sales/history?pay=CASH&size=50", null).path("data").path("items")
                .forEach(r -> assertThat(r.toString()).contains("CASH"));

        Session dana = login(DANA, DEMO_PASSWORD);
        JsonNode sales = shop(dana, "GET", "/api/sales/history?from=2020-01-01", null).path("data");
        assertThat(sales.path("total").asLong()).isPositive();

        JsonNode done = shop(dana, "GET", "/api/appointments/list?status=COMPLETED&size=5&sort=-when", null)
                .path("data");
        assertThat(done.path("total").asLong()).isPositive();
        done.path("items").forEach(a -> assertThat(a.path("status").asText()).isEqualTo("COMPLETED"));
        List<String> days = new ArrayList<>();
        done.path("items").forEach(a -> days.add(a.path("date").asText()));
        assertThat(days).isSortedAccordingTo(java.util.Comparator.reverseOrder());
    }

    @Test
    void a_salon_accepts_several_requests_at_once() throws Exception {
        Session dana = login(DANA, DEMO_PASSWORD);
        Session c = customer();
        String a = as(c, "POST", "/api/me/bookings", booking(CUT_SLUG, null, workday(73), 780)).path("data")
                .path("number").asText();
        String b = as(c, "POST", "/api/me/bookings", booking(CUT_SLUG, null, workday(74), 840)).path("data")
                .path("number").asText();
        JsonNode r = shop(dana, "POST", "/api/appointments/bulk-status",
                Map.of("refs", List.of(a, b, "BK-00000"), "status", Map.of("status", "BOOKED"))).path("data");
        assertThat(r.path("done").asInt()).isEqualTo(2);
        assertThat(r.path("failed").size()).isEqualTo(1);
        assertThat(shop(dana, "GET", "/api/appointments/" + a, null).path("data").path("status").asText())
                .isEqualTo("BOOKED");
    }

    @Test
    void stock_history_notifications_and_services_online_page_and_filter() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        JsonNode moves = shop(nita, NITA_GADGET_ID, "GET", "/api/inventory/movements/history?size=5", null)
                .path("data");
        assertThat(moves.path("total").asLong()).isPositive();
        shop(nita, NITA_GADGET_ID, "GET", "/api/inventory/movements/history?direction=out&size=50", null)
                .path("data").path("items").forEach(m -> assertThat(m.path("delta").asInt()).isNegative());
        shop(nita, NITA_GADGET_ID, "GET", "/api/inventory/movements/history?reason=RECEIVED&size=50", null)
                .path("data").path("items").forEach(m -> assertThat(m.path("reason").asText()).isEqualTo("RECEIVED"));
        assertThat(shop(nita, NITA_GADGET_ID, "GET", "/api/inventory/movements/history?q=USB-C", null).path("data")
                .path("total").asLong()).isPositive();
        String csv = mvc.perform(get("/api/exports/movements").header("Authorization", nita.bearer())
                .header("X-Business-Id", NITA_GADGET_ID)).andReturn().getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        assertThat(csv).startsWith("\uFEFF\"Time\",\"Product\"");

        JsonNode inbox = shop(nita, NITA_GADGET_ID, "GET", "/api/notifications/history?size=3", null).path("data");
        assertThat(inbox.path("items").size()).isLessThanOrEqualTo(3);
        assertThat(inbox.path("total").asLong()).isGreaterThanOrEqualTo(inbox.path("items").size());
        shop(nita, NITA_GADGET_ID, "GET", "/api/notifications/history?unread=true&size=50", null).path("data")
                .path("items").forEach(n -> assertThat(n.path("unread").asBoolean()).isTrue());

        Session dana = login(DANA, DEMO_PASSWORD);
        JsonNode svc = shop(dana, "GET", "/api/catalog/services", null).path("data");
        String a = svc.path(0).path("id").asText();
        String b = svc.path(1).path("id").asText();
        JsonNode off = shop(dana, "POST", "/api/catalog/services/online",
                Map.of("ids", List.of(a, b, "99999999-9999-4999-8999-999999999999"), "online", false)).path("data");
        assertThat(off.path("done").asInt()).isEqualTo(2);
        assertThat(off.path("failed").size()).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from service where id in (?::uuid, ?::uuid) and not bookable_online",
                Integer.class, a, b)).isEqualTo(2);
        shop(dana, "POST", "/api/catalog/services/online", Map.of("ids", List.of(a, b), "online", true));
    }

    @Test
    void a_person_saves_views_per_list_replaces_by_name_and_sees_only_their_own() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        String list = "seller.orders." + System.nanoTime() % 100000;
        JsonNode v = as(nita, "POST", "/api/me/views", Map.of("list", list, "name", "Pickup this month",
                "query", "?method=PICKUP&from=2026-10-01&to=2026-10-31&page=3")).path("data");
        assertThat(v.path("query").asText()).isEqualTo("method=PICKUP&from=2026-10-01&to=2026-10-31");
        JsonNode again = as(nita, "POST", "/api/me/views", Map.of("list", list, "name", "pickup THIS month",
                "query", "method=DELIVERY")).path("data");
        assertThat(again.path("id").asText()).isEqualTo(v.path("id").asText());
        assertThat(as(nita, "GET", "/api/me/views?list=" + list, null).path("data").size()).isEqualTo(1);

        Session dana = login(DANA, DEMO_PASSWORD);
        assertThat(as(dana, "GET", "/api/me/views?list=" + list, null).path("data").size()).isZero();
        assertThat(code(body(mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .delete("/api/me/views/" + v.path("id").asText()).header("Authorization", dana.bearer()))
                .andReturn()))).isEqualTo("NOT_FOUND");
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .delete("/api/me/views/" + v.path("id").asText()).header("Authorization", nita.bearer()));
        assertThat(as(nita, "GET", "/api/me/views?list=" + list, null).path("data").size()).isZero();
        assertThat(code(as(nita, "POST", "/api/me/views", Map.of("list", "Bad List!", "name", "x"))))
                .isEqualTo("VALIDATION_FAILED");
    }
}
