package com.kosign.vbiz.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import com.fasterxml.jackson.databind.JsonNode;

/** Manual orders (docs/api/phase8-manual-orders.md). */
class ManualOrderIntegrationTest extends OrderTestSupport {

    private JsonNode manual(Session s, String businessId, Map<String, Object> body) throws Exception {
        return body(mvc.perform(post("/api/orders/manual").header("Authorization", s.bearer())
                .header("X-Business-Id", businessId).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body))).andReturn());
    }

    private static Map<String, Object> phoneOrder(String phone) {
        Map<String, Object> m = new HashMap<>();
        m.put("source", "PHONE");
        m.put("name", "Chan Sophea");
        m.put("phone", phone);
        m.put("method", "DELIVERY");
        m.put("line", "#12, St. 271");
        m.put("district", "Toul Kork");
        m.put("lines", List.of(line(CABLE, 2)));
        m.put("payment", "COD");
        m.put("note", "Call before arriving");
        return m;
    }

    @Test
    void a_phone_order_joins_the_list_accepted_and_takes_stock() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        int cable = stockOf(CABLE);
        String phone = uniquePhone();
        JsonNode r = manual(nita, NITA_GADGET_ID, phoneOrder(phone));
        assertThat(r.path("status").path("code").asText()).isEqualTo("SUCCESS");
        JsonNode o = r.path("data");
        assertThat(o.path("status").asText()).isEqualTo("ACCEPTED");
        assertThat(o.path("source").asText()).isEqualTo("PHONE");
        assertThat(o.path("customer").path("name").asText()).isEqualTo("Chan Sophea");
        assertThat(o.path("customer").path("phone").asText()).isEqualTo(phone);
        assertThat(o.path("customer").has("id")).isFalse();
        // Toul Kork is in Nita's 1.50 zone; the cable is $6.00.
        assertThat(o.path("deliveryFee").decimalValue()).isEqualByComparingTo("1.50");
        assertThat(o.path("total").decimalValue()).isEqualByComparingTo("13.50");
        assertThat(o.path("payment").path("status").asText()).isEqualTo("PENDING");
        assertThat(stockOf(CABLE)).isEqualTo(cable - 2);
        assertThat(movementSumMismatches()).isZero();
        assertThat(jdbc.queryForObject("select commission::text from payment p join orders o on o.id = p.order_id"
                + " where o.number = ?", String.class, o.path("number").asText())).isEqualTo("0.00");
        // The customer joins the shop's clients by phone.
        assertThat(jdbc.queryForObject("select count(*) from client where business_id = ?::uuid and phone = ?",
                Integer.class, NITA_GADGET_ID, phone)).isEqualTo(1);

        // It is an ordinary order from here: pack, ship, deliver; the cash is collected.
        String no = o.path("number").asText();
        assertThat(seller(nita, "GET", "/api/orders/" + no, null).path("data").path("number").asText()).isEqualTo(no);
        seller(nita, "POST", "/api/orders/" + no + "/pack", null);
        seller(nita, "POST", "/api/orders/" + no + "/ship", Map.of("deliveryBy", "OWN_DELIVERY"));
        JsonNode done = seller(nita, "POST", "/api/orders/" + no + "/deliver", Map.of("cashCollected", true))
                .path("data");
        assertThat(done.path("status").asText()).isEqualTo("DELIVERED");
        assertThat(done.path("payment").path("status").asText()).isEqualTo("PAID");

        // Support sees it too, under the contact's name.
        Session admin = login("admin@virtualbiz.com", DEMO_PASSWORD);
        JsonNode found = body(mvc.perform(get("/api/admin/orders?q=" + no).header("Authorization", admin.bearer()))
                .andReturn()).path("data");
        assertThat(found.path("items").get(0).path("customerName").asText()).isEqualTo("Chan Sophea");
    }

    @Test
    void a_walk_in_paid_by_khqr_is_paid_to_the_shop_not_through_virtualbiz() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        Map<String, Object> in = new HashMap<>();
        in.put("source", "WALK_IN");
        in.put("name", "Walk-in customer");
        in.put("method", "PICKUP");
        in.put("lines", List.of(line(CABLE, 1)));
        in.put("discount", 1);
        in.put("payment", "PAID_KHQR");
        JsonNode o = manual(nita, NITA_GADGET_ID, in).path("data");
        assertThat(o.path("total").decimalValue()).isEqualByComparingTo("5.00");
        assertThat(o.path("payment").path("status").asText()).isEqualTo("PAID");
        assertThat(jdbc.queryForObject("select channel from payment p join orders o on o.id = p.order_id"
                + " where o.number = ?", String.class, o.path("number").asText())).isEqualTo("DIRECT");
    }

    @Test
    void checks_what_staff_enter() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        Map<String, Object> noPhone = phoneOrder(uniquePhone());
        noPhone.remove("phone");
        assertThat(manual(nita, NITA_GADGET_ID, noPhone).path("error").path("details").get(0).path("field").asText())
                .isEqualTo("phone");

        Map<String, Object> online = phoneOrder(uniquePhone());
        online.put("source", "ONLINE");
        assertThat(manual(nita, NITA_GADGET_ID, online).path("status").path("code").asText())
                .isEqualTo("VALIDATION_FAILED");

        Map<String, Object> other = phoneOrder(uniquePhone());
        other.put("lines", List.of(line(RICE, 1))); // Fresh Mart's, not Nita's
        assertThat(manual(nita, NITA_GADGET_ID, other).path("status").path("code").asText())
                .isEqualTo("VARIANT_NOT_FOUND");

        Map<String, Object> tooMuch = phoneOrder(uniquePhone());
        tooMuch.put("discount", 50);
        assertThat(manual(nita, NITA_GADGET_ID, tooMuch).path("status").path("code").asText())
                .isEqualTo("VALIDATION_FAILED");

        Map<String, Object> huge = phoneOrder(uniquePhone());
        huge.put("lines", List.of(line(CABLE, 999)));
        assertThat(manual(nita, NITA_GADGET_ID, huge).path("status").path("code").asText())
                .isEqualTo("INSUFFICIENT_STOCK");

        Session dana = login(DANA, DEMO_PASSWORD);
        assertThat(manual(dana, GLOW_BEAUTY_ID, phoneOrder(uniquePhone())).path("status").path("code").asText())
                .isEqualTo("WRONG_BUSINESS_TYPE");
    }
}
