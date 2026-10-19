package com.kosign.vbiz.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.order.OrderTestSupport;

/** The super-admin console (docs/api/phase7-admin.md). */
class AdminIntegrationTest extends OrderTestSupport {

    private static final String ADMIN = "admin@virtualbiz.com";
    private static final String SUPPORT = "support@virtualbiz.com";
    private static final String ADMIN_ID = "11111111-1111-4111-8111-000000000091";
    private static final String NITA_ID = "11111111-1111-4111-8111-000000000001";
    private static final String HAPPY_COFFEE_ID = "22222222-2222-4222-8222-000000000011";
    private static final String BAKERY_ID = "22222222-2222-4222-8222-000000000021";

    private JsonNode call(Session s, String method, String path, Object body) throws Exception {
        var req = switch (method) {
            case "GET" -> get(path);
            case "PUT" -> put(path);
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
    void only_staff_reach_the_console() throws Exception {
        assertThat(code(call(null, "GET", "/api/admin/overview", null))).isEqualTo("UNAUTHORIZED");
        Session nita = login(NITA, DEMO_PASSWORD);
        assertThat(code(call(nita, "GET", "/api/admin/overview", null))).isEqualTo("ADMIN_ONLY");
        assertThat(nita.user().has("platformRole")).isFalse();

        Session admin = login(ADMIN, DEMO_PASSWORD);
        assertThat(admin.user().path("platformRole").asText()).isEqualTo("SUPER_ADMIN");
        JsonNode o = call(admin, "GET", "/api/admin/overview", null).path("data");
        assertThat(o.path("days").size()).isEqualTo(30);
        assertThat(o.path("counts").path("shops").asLong()).isGreaterThanOrEqualTo(10);
        assertThat(o.path("queues").path("pendingVerifications").isIntegralNumber()).isTrue();
        assertThat(o.path("last30").path("gmv").decimalValue()).isPositive();
        assertThat(o.path("topShops").size()).isPositive();
    }

    @Test
    void verify_reject_and_resubmit_an_id() throws Exception {
        Session admin = login(ADMIN, DEMO_PASSWORD);
        JsonNode queue = call(admin, "GET", "/api/admin/businesses?verification=PENDING&sort=pending", null)
                .path("data");
        assertThat(queue.path("items").findValuesAsText("id")).contains(BAKERY_ID);
        JsonNode photo = call(admin, "GET", "/api/admin/businesses/" + BAKERY_ID + "/id-photo", null).path("data");
        assertThat(photo.path("dataUrl").asText()).startsWith("data:image/png;base64,");

        assertThat(code(call(admin, "POST", "/api/admin/businesses/" + BAKERY_ID + "/reject", Map.of("reason", "x"))))
                .isEqualTo("VALIDATION_FAILED");
        JsonNode rejected = call(admin, "POST", "/api/admin/businesses/" + BAKERY_ID + "/reject",
                Map.of("reason", "The photo is blurry")).path("data");
        assertThat(rejected.path("shop").path("verification").asText()).isEqualTo("REJECTED");
        assertThat(rejected.path("verificationNote").asText()).isEqualTo("The photo is blurry");
        assertThat(rejected.path("history").get(0).path("action").asText()).isEqualTo("BUSINESS_REJECTED");

        // The owner sees why, and sends a new photo: back in the queue.
        Session owner = login("sreyleak@shops.virtualbiz.com", DEMO_PASSWORD);
        var patch = org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .patch("/api/businesses/" + BAKERY_ID).header("Authorization", owner.bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("idPhoto", "data:image/png;base64,"
                        + java.util.Base64.getEncoder().encodeToString(png()))));
        JsonNode resubmitted = body(mvc.perform(patch).andReturn()).path("data");
        assertThat(resubmitted.path("verification").asText()).isEqualTo("PENDING");
        assertThat(jdbc.queryForObject("select count(*) from notification where business_id = ?::uuid and kind = ?",
                Integer.class, BAKERY_ID, "BUSINESS_REJECTED")).isEqualTo(1);

        JsonNode verified = call(admin, "POST", "/api/admin/businesses/" + BAKERY_ID + "/verify", null).path("data");
        assertThat(verified.path("shop").path("verification").asText()).isEqualTo("VERIFIED");
        assertThat(verified.path("verifiedByName").asText()).isEqualTo("Sok Vanna");
        assertThat(code(call(admin, "POST", "/api/admin/businesses/" + BAKERY_ID + "/verify", null)))
                .isEqualTo("INVALID_STATUS_TRANSITION");
    }

    @Test
    void a_suspended_shop_leaves_the_marketplace_until_reinstated() throws Exception {
        Session admin = login(ADMIN, DEMO_PASSWORD);
        assertThat(code(call(null, "GET", "/api/marketplace/shops/happy-coffee", null))).isEqualTo("SUCCESS");
        JsonNode s = call(admin, "POST", "/api/admin/businesses/" + HAPPY_COFFEE_ID + "/suspend",
                Map.of("reason", "Selling counterfeit goods")).path("data");
        assertThat(s.path("shop").path("suspendedAt").isTextual()).isTrue();
        try {
            assertThat(code(call(null, "GET", "/api/marketplace/shops/happy-coffee", null)))
                    .isEqualTo("BUSINESS_NOT_FOUND");
            assertThat(call(null, "GET", "/api/marketplace/shops", null).path("data").findValuesAsText("slug"))
                    .doesNotContain("happy-coffee");
            assertThat(call(null, "GET", "/api/marketplace/search?q=coffee", null).toString())
                    .doesNotContain("happy-coffee");
            assertThat(code(call(admin, "POST", "/api/admin/businesses/" + HAPPY_COFFEE_ID + "/suspend",
                    Map.of("reason", "again")))).isEqualTo("CONFLICT");
        } finally {
            call(admin, "POST", "/api/admin/businesses/" + HAPPY_COFFEE_ID + "/reinstate", null);
        }
        assertThat(code(call(null, "GET", "/api/marketplace/shops/happy-coffee", null))).isEqualTo("SUCCESS");
        JsonNode log = call(admin, "GET", "/api/admin/audit?targetType=BUSINESS&targetId=" + HAPPY_COFFEE_ID, null)
                .path("data").path("items");
        assertThat(log.findValuesAsText("action")).containsSubsequence("BUSINESS_REINSTATED", "BUSINESS_SUSPENDED");
    }

    @Test
    void suspending_an_account_signs_it_out_at_once() throws Exception {
        Session admin = login(ADMIN, DEMO_PASSWORD);
        String email = uniqueEmail("bad");
        Session bad = signUp("Bad Actor", email, "Bright#2026");
        String id = bad.user().path("id").asText();
        assertThat(code(call(bad, "GET", "/api/me", null))).isEqualTo("SUCCESS");

        assertThat(code(call(admin, "POST", "/api/admin/users/" + id + "/suspend", Map.of()))).isEqualTo(
                "VALIDATION_FAILED");
        JsonNode d = call(admin, "POST", "/api/admin/users/" + id + "/suspend", Map.of("reason", "Fraudulent orders"))
                .path("data");
        assertThat(d.path("user").path("suspendedAt").isTextual()).isTrue();
        // The access token in hand stops working now, not in 15 minutes; signing in again is refused.
        assertThat(code(call(bad, "GET", "/api/me", null))).isEqualTo("UNAUTHORIZED");
        assertThat(code(body(mvc.perform(postJson("/api/auth/login", Map.of("email", email, "password",
                "Bright#2026"))).andReturn()))).isEqualTo("ACCOUNT_SUSPENDED");
        assertThat(code(body(mvc.perform(post("/api/auth/refresh").cookie(bad.refresh())).andReturn())))
                .isEqualTo("REFRESH_TOKEN_INVALID");

        call(admin, "POST", "/api/admin/users/" + id + "/reinstate", null);
        assertThat(code(call(login(email, "Bright#2026"), "GET", "/api/me", null))).isEqualTo("SUCCESS");
    }

    @Test
    void staff_roles_are_for_super_admins_only() throws Exception {
        Session admin = login(ADMIN, DEMO_PASSWORD);
        Session support = login(SUPPORT, DEMO_PASSWORD);
        assertThat(code(call(support, "GET", "/api/admin/users?kind=staff", null))).isEqualTo("SUCCESS");
        assertThat(code(call(support, "POST", "/api/admin/users/" + ADMIN_ID + "/suspend",
                Map.of("reason", "Taking over")))).isEqualTo("SUPER_ADMIN_ONLY");
        assertThat(code(call(support, "PUT", "/api/admin/users/" + NITA_ID + "/role", Map.of("role", "ADMIN"))))
                .isEqualTo("SUPER_ADMIN_ONLY");
        assertThat(code(call(admin, "PUT", "/api/admin/users/" + ADMIN_ID + "/role", new HashMap<>())))
                .isEqualTo("FORBIDDEN");

        Session buyer = signUp("New Staff", uniqueEmail("staff"), "Bright#2026");
        String id = buyer.user().path("id").asText();
        JsonNode made = call(admin, "PUT", "/api/admin/users/" + id + "/role", Map.of("role", "ADMIN")).path("data");
        assertThat(made.path("user").path("platformRole").asText()).isEqualTo("ADMIN");
        assertThat(code(call(buyer, "GET", "/api/admin/overview", null))).isEqualTo("SUCCESS");
        call(admin, "PUT", "/api/admin/users/" + id + "/role", new HashMap<>());
        assertThat(code(call(buyer, "GET", "/api/admin/overview", null))).isEqualTo("ADMIN_ONLY");
    }

    @Test
    void support_cancels_an_accepted_order_and_refunds_a_delivered_one() throws Exception {
        Session admin = login(ADMIN, DEMO_PASSWORD);
        Session nita = login(NITA, DEMO_PASSWORD);
        Customer c = newCustomer("BKK1");
        int cable = stockOf(CABLE);
        JsonNode o = place(c, checkout(c.addressId(), "CARD", List.of(line(CABLE, 2)))).path("data").path("orders")
                .get(0);
        String no = o.path("number").asText();
        seller(nita, "POST", "/api/orders/accept", Map.of("ids", List.of(o.path("id").asText())));

        JsonNode found = call(admin, "GET", "/api/admin/orders?q=" + no, null).path("data");
        assertThat(found.path("total").asLong()).isEqualTo(1);
        assertThat(found.path("items").get(0).path("status").asText()).isEqualTo("ACCEPTED");

        JsonNode cancelled = call(admin, "POST", "/api/admin/orders/" + no + "/cancel",
                Map.of("reason", "Customer charged twice")).path("data");
        assertThat(cancelled.path("order").path("status").asText()).isEqualTo("CANCELLED");
        assertThat(cancelled.path("order").path("cancelReason").asText()).isEqualTo("admin.cancel");
        assertThat(cancelled.path("payment").path("status").asText()).isEqualTo("REFUNDED");
        assertThat(cancelled.path("events").findValuesAsText("note")).contains("Customer charged twice");
        assertThat(stockOf(CABLE)).isEqualTo(cable);
        assertThat(code(call(admin, "POST", "/api/admin/orders/" + no + "/cancel", Map.of("reason", "again"))))
                .isEqualTo("INVALID_STATUS_TRANSITION");

        // A delivered order: refund (no return window for support), items back on the shelf.
        JsonNode d = place(c, checkout(c.addressId(), "CARD", List.of(line(CABLE, 1)))).path("data").path("orders")
                .get(0);
        String dn = d.path("number").asText();
        seller(nita, "POST", "/api/orders/accept", Map.of("ids", List.of(d.path("id").asText())));
        seller(nita, "POST", "/api/orders/" + dn + "/pack", null);
        seller(nita, "POST", "/api/orders/" + dn + "/ship", Map.of("deliveryBy", "OWN_DELIVERY"));
        seller(nita, "POST", "/api/orders/" + dn + "/deliver", Map.of("cashCollected", true));
        assertThat(code(call(admin, "POST", "/api/admin/orders/" + dn + "/cancel", Map.of("reason", "Late"))))
                .isEqualTo("INVALID_STATUS_TRANSITION");
        JsonNode refunded = call(admin, "POST", "/api/admin/orders/" + dn + "/refund",
                Map.of("reason", "Item arrived broken", "restock", true)).path("data");
        assertThat(refunded.path("order").path("status").asText()).isEqualTo("RETURNED");
        assertThat(refunded.path("payment").path("status").asText()).isEqualTo("REFUNDED");
        assertThat(stockOf(CABLE)).isEqualTo(cable);
        assertThat(refunded.path("history").get(0).path("action").asText()).isEqualTo("ORDER_REFUNDED");
    }

    @Test
    void a_hidden_review_leaves_lists_and_ratings() throws Exception {
        Session admin = login(ADMIN, DEMO_PASSWORD);
        JsonNode list = call(admin, "GET", "/api/admin/reviews?businessId=" + HAPPY_COFFEE_ID + "&status=visible",
                null).path("data");
        int before = list.path("total").asInt();
        assertThat(before).isPositive();
        JsonNode review = list.path("items").get(0);
        String id = review.path("id").asText();
        int countBefore = jdbc.queryForObject("select review_count from business where id = ?::uuid", Integer.class,
                HAPPY_COFFEE_ID);

        JsonNode hidden = call(admin, "POST", "/api/admin/reviews/" + id + "/hide", Map.of("reason", "Spam link"))
                .path("data");
        assertThat(hidden.path("hiddenReason").asText()).isEqualTo("Spam link");
        assertThat(call(null, "GET", "/api/marketplace/shops/happy-coffee/reviews", null).path("data")
                .findValuesAsText("id")).doesNotContain(id);
        assertThat(jdbc.queryForObject("select review_count from business where id = ?::uuid", Integer.class,
                HAPPY_COFFEE_ID)).isEqualTo(countBefore - 1);

        call(admin, "POST", "/api/admin/reviews/" + id + "/restore", null);
        assertThat(jdbc.queryForObject("select review_count from business where id = ?::uuid", Integer.class,
                HAPPY_COFFEE_ID)).isEqualTo(countBefore);
        // The rating is the average of the visible reviews again.
        assertThat(jdbc.queryForObject("select rating::text from business where id = ?::uuid", String.class,
                HAPPY_COFFEE_ID)).isEqualTo(jdbc.queryForObject(
                        "select round(avg(stars), 1)::text from review where business_id = ?::uuid and hidden_at is null",
                        String.class, HAPPY_COFFEE_ID));
    }

    @Test
    void platform_promo_codes() throws Exception {
        Session admin = login(ADMIN, DEMO_PASSWORD);
        String code = "VB" + Long.toString(System.nanoTime() % 1_000_000_000L, 36).toUpperCase();
        Map<String, Object> in = new HashMap<>(Map.of("name", "Water festival", "type", "PERCENT", "value", 10,
                "code", code, "scope", "ALL", "startsAt", Instant.now().minus(1, ChronoUnit.HOURS).toString(),
                "endsAt", Instant.now().plus(3, ChronoUnit.DAYS).toString()));
        JsonNode created = call(admin, "POST", "/api/admin/promotions", in).path("data");
        assertThat(created.path("businessId").isMissingNode() || created.path("businessId").isNull()).isTrue();
        assertThat(created.path("state").asText()).isEqualTo("ACTIVE");
        assertThat(call(null, "GET", "/api/marketplace/promotions", null).toString()).contains(code);
        JsonNode dup = call(admin, "POST", "/api/admin/promotions", in);
        assertThat(code(dup)).isEqualTo("VALIDATION_FAILED");

        in.put("scope", "PRODUCTS");
        assertThat(code(call(admin, "POST", "/api/admin/promotions", in))).isEqualTo("VALIDATION_FAILED");

        JsonNode ended = call(admin, "POST", "/api/admin/promotions/" + created.path("id").asText() + "/end", null)
                .path("data");
        assertThat(ended.path("state").asText()).isEqualTo("ENDED");
        assertThat(call(admin, "GET", "/api/audit", null).toString()).isNotNull();
    }

    @Test
    void pay_out_a_shops_released_balance() throws Exception {
        Session admin = login(ADMIN, DEMO_PASSWORD);
        JsonNode balances = call(admin, "GET", "/api/admin/payouts/balances", null).path("data");
        JsonNode nitaBal = null;
        for (JsonNode b : balances) {
            if (b.path("businessId").asText().equals(NITA_GADGET_ID)) {
                nitaBal = b;
            }
        }
        assertThat(nitaBal).isNotNull();
        BigDecimal payable = nitaBal.path("payable").decimalValue();
        assertThat(payable).isPositive();
        assertThat(nitaBal.path("released").decimalValue().subtract(nitaBal.path("commission").decimalValue())
                .subtract(nitaBal.path("takenBack").decimalValue())).isLessThanOrEqualTo(payable);

        assertThat(code(call(admin, "POST", "/api/admin/payouts", Map.of("businessId", NITA_GADGET_ID))))
                .isEqualTo("VALIDATION_FAILED");
        assertThat(code(call(admin, "POST", "/api/admin/payouts", Map.of("businessId",
                "22222222-2222-4222-8222-000000000099", "reference", "ABA-1")))).isEqualTo("BUSINESS_NOT_FOUND");

        JsonNode paid = call(admin, "POST", "/api/admin/payouts", Map.of("businessId", NITA_GADGET_ID,
                "reference", "ABA-778812", "note", "Weekly")).path("data");
        assertThat(paid.path("amount").decimalValue()).isEqualByComparingTo(payable);
        assertThat(paid.path("bakongId").asText()).isEqualTo("nitagadget@aba");
        assertThat(paid.path("paidByName").asText()).isEqualTo("Sok Vanna");
        assertThat(code(call(admin, "POST", "/api/admin/payouts", Map.of("businessId", NITA_GADGET_ID,
                "reference", "ABA-778813")))).isEqualTo("NOTHING_TO_PAY");

        // The shop sees it, and its inbox says so.
        Session nita = login(NITA, DEMO_PASSWORD);
        JsonNode mine = body(mvc.perform(get("/api/payouts").header("Authorization", nita.bearer())
                .header("X-Business-Id", NITA_GADGET_ID)).andReturn()).path("data");
        assertThat(mine.path("payouts").get(0).path("reference").asText()).isEqualTo("ABA-778812");
        assertThat(mine.path("balance").path("payable").decimalValue()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(mine.path("releaseDays").asInt()).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from notification where business_id = ?::uuid and kind = ?",
                Integer.class, NITA_GADGET_ID, "PAYOUT_SENT")).isEqualTo(1);
    }

    @Test
    void a_pending_shop_cannot_be_paid_out() throws Exception {
        Session admin = login(ADMIN, DEMO_PASSWORD);
        Session owner = signUp("Pending Owner", uniqueEmail("pend"), "Bright#2026");
        JsonNode b = body(mvc.perform(postJson("/api/businesses", Map.of("type", "PRODUCT", "name", "Pending Shop",
                "categoryId", "electronics", "district", "BKK1", "street", "#1, St. 1", "phone", uniquePhone(),
                "hours", Map.of("open", "08:00", "close", "20:00", "sunday", true)))
                .header("Authorization", owner.bearer())).andReturn()).path("data");
        assertThat(b.has("bakongId")).isFalse();
        assertThat(code(call(admin, "POST", "/api/admin/payouts", Map.of("businessId", b.path("id").asText(),
                "reference", "ABA-1")))).isEqualTo("VERIFICATION_REQUIRED");
    }

    private static byte[] png() {
        return java.util.Base64.getDecoder().decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");
    }
}
