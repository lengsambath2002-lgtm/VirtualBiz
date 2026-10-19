package com.kosign.vbiz.order;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.order.scheduler.OrderJobs;
import com.kosign.vbiz.support.MutableClock;

class OrderFlowIntegrationTest extends OrderTestSupport {

    @Autowired
    OrderJobs jobs;

    @Autowired
    java.time.Clock clock;

    private JsonNode nitaOrder(Customer c, String pay, String method, int qty) throws Exception {
        Map<String, Object> body = checkout(c.addressId(), pay, List.of(line(CABLE, qty)));
        body.put("method", method);
        if (method.equals("PICKUP")) {
            body.remove("addressId");
        }
        JsonNode r = place(c, body);
        assertThat(r.path("status").path("code").asText()).isEqualTo("SUCCESS");
        return r.path("data").path("orders").get(0);
    }

    @Test
    void accept_pack_ship_deliver_with_cash_on_delivery() throws Exception {
        Customer c = newCustomer("Toul Kork");
        Session nita = login(NITA, DEMO_PASSWORD);
        JsonNode o = nitaOrder(c, "CASH", "DELIVERY", 1);
        String id = o.path("id").asText();
        String no = o.path("number").asText();

        JsonNode acc = seller(nita, "POST", "/api/orders/accept", Map.of("ids", List.of(id))).path("data");
        assertThat(acc.path("orders").get(0).path("status").asText()).isEqualTo("ACCEPTED");
        // Undo within 30 s, then accept again.
        assertThat(seller(nita, "POST", "/api/orders/accept/undo", Map.of("ids", List.of(id))).path("data")
                .path("orders").get(0).path("status").asText()).isEqualTo("NEW");
        seller(nita, "POST", "/api/orders/accept", Map.of("ids", List.of(id)));
        // The customer may no longer cancel.
        assertThat(customerPost(c, "/api/me/orders/" + no + "/cancel", Map.of("reason", "mistake"))
                .path("status").path("code").asText()).isEqualTo("CANCEL_WINDOW_PASSED");
        assertThat(seller(nita, "POST", "/api/orders/" + no + "/ship", Map.of("deliveryBy", "VIRTUALBIZ_RIDER"))
                .path("status").path("code").asText()).isEqualTo("INVALID_STATUS_TRANSITION");
        seller(nita, "POST", "/api/orders/" + no + "/pack", null);
        JsonNode shipped = seller(nita, "POST", "/api/orders/" + no + "/ship",
                Map.of("deliveryBy", "VIRTUALBIZ_RIDER")).path("data");
        assertThat(shipped.path("status").asText()).isEqualTo("SHIPPED");
        assertThat(shipped.path("rider").path("name").asText()).isNotBlank();
        // Failed delivery goes back to PACKED with a note, then ship again (own delivery) and deliver.
        JsonNode failed = seller(nita, "POST", "/api/orders/" + no + "/fail", Map.of("reason", "noAnswer")).path("data");
        assertThat(failed.path("status").asText()).isEqualTo("PACKED");
        assertThat(failed.path("timeline").findValuesAsText("note")).contains("failed.noAnswer");
        seller(nita, "POST", "/api/orders/" + no + "/ship", Map.of("deliveryBy", "OWN_DELIVERY"));
        JsonNode done = seller(nita, "POST", "/api/orders/" + no + "/deliver", null).path("data");
        assertThat(done.path("status").asText()).isEqualTo("DELIVERED");
        assertThat(done.path("payment").path("status").asText()).isEqualTo("PAID");
        assertThat(done.path("deliveryBy").asText()).isEqualTo("OWN_DELIVERY");

        // The customer's inbox followed along; mark it read.
        JsonNode inbox = customerGet(c, "/api/me/notifications").path("data");
        assertThat(inbox.findValuesAsText("kind")).contains("ORDER_ACCEPTED", "ORDER_ON_THE_WAY", "ORDER_DELIVERED");
        customerPost(c, "/api/me/notifications/read-all", null);
        assertThat(customerGet(c, "/api/me/notifications").path("data").findValuesAsText("unread"))
                .containsOnly("false");
        // Return within 7 days, back on the shelf.
        int cable = stockOf(CABLE);
        JsonNode ret = seller(nita, "POST", "/api/orders/" + no + "/return",
                Map.of("reason", "damaged", "restock", true)).path("data");
        assertThat(ret.path("status").asText()).isEqualTo("RETURNED");
        assertThat(ret.path("payment").path("status").asText()).isEqualTo("REFUNDED");
        assertThat(stockOf(CABLE)).isEqualTo(cable + 1);
        assertThat(movementSumMismatches()).isZero();
    }

    @Test
    void pickup_orders_are_picked_up_not_shipped_and_bulk_actions_skip_others() throws Exception {
        Customer c = newCustomer("BKK1");
        Session nita = login(NITA, DEMO_PASSWORD);
        JsonNode o = nitaOrder(c, "CASH", "PICKUP", 1);
        String id = o.path("id").asText();
        String no = o.path("number").asText();
        seller(nita, "POST", "/api/orders/accept", Map.of("ids", List.of(id)));
        JsonNode bulk = seller(nita, "POST", "/api/orders/bulk", Map.of("action", "PACK", "ids", List.of(id))).path("data");
        assertThat(bulk.path("orders").get(0).path("status").asText()).isEqualTo("PACKED");
        assertThat(seller(nita, "POST", "/api/orders/" + no + "/ship", Map.of("deliveryBy", "OWN_DELIVERY"))
                .path("status").path("code").asText()).isEqualTo("INVALID_STATUS_TRANSITION");
        JsonNode shipBulk = seller(nita, "POST", "/api/orders/bulk", Map.of("action", "SHIP", "ids", List.of(id)))
                .path("data");
        assertThat(shipBulk.path("orders").get(0).path("status").asText()).isEqualTo("PICKED_UP");
        assertThat(shipBulk.path("orders").get(0).path("payment").path("paid").asBoolean()).isTrue();
        JsonNode again = seller(nita, "POST", "/api/orders/bulk", Map.of("action", "SHIP", "ids", List.of(id))).path("data");
        assertThat(again.path("skipped").get(0).asText()).isEqualTo(id);
    }

    @Test
    void reject_restocks_and_refunds_a_paid_order() throws Exception {
        Customer c = newCustomer("BKK1");
        Session nita = login(NITA, DEMO_PASSWORD);
        int cable = stockOf(CABLE);
        JsonNode o = nitaOrder(c, "CARD", "DELIVERY", 2);
        assertThat(stockOf(CABLE)).isEqualTo(cable - 2);
        assertThat(seller(nita, "POST", "/api/orders/" + o.path("number").asText() + "/reject",
                Map.of("reason", "whatever")).path("status").path("code").asText()).isEqualTo("VALIDATION_FAILED");
        JsonNode r = seller(nita, "POST", "/api/orders/" + o.path("number").asText() + "/reject",
                Map.of("reason", "cantDeliver")).path("data");
        assertThat(r.path("status").asText()).isEqualTo("CANCELLED");
        assertThat(r.path("cancelReason").asText()).isEqualTo("rejected.cantDeliver");
        assertThat(r.path("payment").path("status").asText()).isEqualTo("REFUNDED");
        assertThat(stockOf(CABLE)).isEqualTo(cable);
        assertThat(jdbc.queryForObject("""
                select count(*) from stock_movement where reason = 'ORDER_CANCELLED' and note = ?""",
                Integer.class, o.path("number").asText())).isEqualTo(1);
        assertThat(customerGet(c, "/api/me/notifications").path("data").get(0).path("kind").asText())
                .isEqualTo("ORDER_CANCELLED");
    }

    @Test
    void the_customer_cancels_within_five_minutes() throws Exception {
        Customer c = newCustomer("BKK1");
        int cable = stockOf(CABLE);
        JsonNode o = nitaOrder(c, "CASH", "DELIVERY", 1);
        assertThat(customerPost(c, "/api/me/orders/" + o.path("number").asText() + "/cancel",
                Map.of("reason", "nope")).path("status").path("code").asText()).isEqualTo("VALIDATION_FAILED");
        JsonNode r = customerPost(c, "/api/me/orders/" + o.path("number").asText() + "/cancel",
                Map.of("reason", "change")).path("data");
        assertThat(r.path("status").asText()).isEqualTo("CANCELLED");
        assertThat(r.path("cancelReason").asText()).isEqualTo("customer.change");
        assertThat(stockOf(CABLE)).isEqualTo(cable);
        // Someone else cannot see it.
        Customer other = newCustomer("BKK1");
        assertThat(customerGet(other, "/api/me/orders/" + o.path("number").asText()).path("status").path("code")
                .asText()).isEqualTo("ORDER_NOT_FOUND");
        // An order placed six minutes ago can no longer be cancelled by the customer.
        JsonNode late = nitaOrder(c, "CASH", "DELIVERY", 1);
        mvc.perform(postJson("/api/dev/orders/" + late.path("number").asText() + "/age", Map.of("minutes", 6))
                .header("Authorization", c.bearer()));
        assertThat(customerPost(c, "/api/me/orders/" + late.path("number").asText() + "/cancel",
                Map.of("reason", "change")).path("status").path("code").asText()).isEqualTo("CANCEL_WINDOW_PASSED");
    }

    @Test
    void orders_not_accepted_within_an_hour_are_auto_cancelled() throws Exception {
        Customer c = newCustomer("BKK1");
        Session nita = login(NITA, DEMO_PASSWORD);
        int cable = stockOf(CABLE);
        JsonNode o = nitaOrder(c, "CARD", "DELIVERY", 1);
        MutableClock later = new MutableClock(clock.instant());
        later.advance(Duration.ofMinutes(59));
        jobs.run(later.instant());
        assertThat(customerGet(c, "/api/me/orders/" + o.path("number").asText()).path("data").path("status")
                .asText()).isEqualTo("NEW");
        later.advance(Duration.ofMinutes(2));
        assertThat(jobs.run(later.instant()).autoCancelled()).isGreaterThanOrEqualTo(1);
        JsonNode r = customerGet(c, "/api/me/orders/" + o.path("number").asText()).path("data");
        assertThat(r.path("status").asText()).isEqualTo("CANCELLED");
        assertThat(r.path("cancelReason").asText()).isEqualTo("auto");
        assertThat(r.path("payment").path("status").asText()).isEqualTo("REFUNDED");
        // Its unit is back (other overdue NEW orders were restocked by the same run).
        assertThat(stockOf(CABLE)).isGreaterThanOrEqualTo(cable);
        assertThat(jdbc.queryForObject("""
                select count(*) from stock_movement where reason = 'ORDER_CANCELLED' and note = ? and delta = 1
                  and by_user_id is null""", Integer.class, o.path("number").asText())).isEqualTo(1);
        assertThat(customerGet(c, "/api/me/notifications").path("data").get(0).path("params").path("reason").asText())
                .isEqualTo("auto");
        JsonNode shopInbox = seller(nita, "GET", "/api/notifications", null).path("data");
        assertThat(shopInbox.get(0).path("kind").asText()).isEqualTo("ORDER_CANCELLED");
        assertThat(movementSumMismatches()).isZero();
    }

    @Test
    void seller_lists_counts_and_seeded_history() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        JsonNode all = seller(nita, "GET", "/api/orders", null).path("data");
        assertThat(all.size()).isGreaterThan(60);
        JsonNode first = seller(nita, "GET", "/api/orders/VB-01047", null).path("data");
        assertThat(first.path("status").asText()).isEqualTo("DELIVERED");
        assertThat(first.path("customer").path("name").asText()).isEqualTo("Monika Lim");
        JsonNode counts = seller(nita, "GET", "/api/orders/counts", null).path("data");
        assertThat(counts.has("new")).isTrue();
        assertThat(counts.path("ship").asLong()).isGreaterThanOrEqualTo(0);
        JsonNode packTab = seller(nita, "GET", "/api/orders?tab=pack", null).path("data");
        packTab.forEach(o -> assertThat(o.path("status").asText()).isEqualTo("ACCEPTED"));
        assertThat(seller(nita, "GET", "/api/orders?q=Tena", null).path("data").findValuesAsText("name"))
                .contains("Tena Heng");
        // Kry Sonita's own seeded order from SK Fashion.
        assertThat(body(mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .get("/api/me/orders/VB-24038").header("Authorization", nita.bearer())).andReturn())
                .path("data").path("shop").path("slug").asText()).isEqualTo("sk-fashion");
        assertThat(movementSumMismatches()).isZero();
    }
}
