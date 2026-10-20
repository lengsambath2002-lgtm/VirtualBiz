package com.kosign.vbiz.business;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.support.IntegrationTest;

/** Shop teams: invites, roles and what each role may do (docs/api/phase10-shop-team.md). */
class TeamIntegrationTest extends IntegrationTest {

    private static final String PASS = "Team#Member2026";

    private JsonNode call(Session s, String method, String path, Object body) throws Exception {
        var req = switch (method) {
            case "GET" -> get(path);
            case "PATCH" -> patch(path);
            case "DELETE" -> delete(path);
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

    private static String token(JsonNode invite) {
        return invite.path("data").path("devLink").asText().replace("/join/", "");
    }

    /** Invite a new person and accept as them; returns their session. */
    private Session join(Session by, String businessId, String role, Map<String, Object> extra) throws Exception {
        Map<String, Object> body = new HashMap<>(Map.of("email", uniqueEmail("team"), "name", "Team Person",
                "role", role));
        body.putAll(extra);
        JsonNode inv = call(by, "POST", "/api/businesses/" + businessId + "/invites", body);
        assertThat(code(inv)).isEqualTo("SUCCESS");
        return session(mvc.perform(postJson("/api/join/" + token(inv) + "/accept",
                Map.of("name", "Team Person", "password", PASS))).andReturn());
    }

    private static String roleIn(JsonNode mine, String businessId) {
        for (JsonNode b : mine.path("data")) {
            if (b.path("id").asText().equals(businessId)) {
                return b.path("role").asText();
            }
        }
        return null;
    }

    @Test
    void the_owner_invites_a_manager_who_runs_the_shop_but_not_its_money_or_roles() throws Exception {
        Session owner = login(NITA, DEMO_PASSWORD);
        Session manager = join(owner, NITA_GADGET_ID, "MANAGER", Map.of());
        assertThat(roleIn(call(manager, "GET", "/api/me/businesses", null), NITA_GADGET_ID)).isEqualTo("MANAGER");

        // Runs the shop…
        assertThat(code(call(manager, "PATCH", "/api/businesses/" + NITA_GADGET_ID,
                Map.of("about", "Phones and accessories, Toul Kork")))).isEqualTo("SUCCESS");
        // …but not the payout account, roles, or other managers.
        assertThat(code(call(manager, "PATCH", "/api/businesses/" + NITA_GADGET_ID,
                Map.of("bakongId", "someone@aclb")))).isEqualTo("FORBIDDEN");
        assertThat(code(call(manager, "POST", "/api/businesses/" + NITA_GADGET_ID + "/invites",
                Map.of("email", uniqueEmail("m2"), "role", "MANAGER")))).isEqualTo("FORBIDDEN");

        // Invites staff; staff can't invite or change settings.
        Session staff = join(manager, NITA_GADGET_ID, "STAFF", Map.of());
        assertThat(roleIn(call(staff, "GET", "/api/me/businesses", null), NITA_GADGET_ID)).isEqualTo("STAFF");
        assertThat(code(call(staff, "POST", "/api/businesses/" + NITA_GADGET_ID + "/invites",
                Map.of("email", uniqueEmail("s2"), "role", "STAFF")))).isEqualTo("FORBIDDEN");
        assertThat(code(call(staff, "PATCH", "/api/businesses/" + NITA_GADGET_ID, Map.of("about", "x"))))
                .isEqualTo("FORBIDDEN");

        // The team shows their emails; only the owner sets roles, never OWNER.
        JsonNode team = call(owner, "GET", "/api/businesses/" + NITA_GADGET_ID + "/members", null).path("data");
        String managerId = null;
        String staffId = null;
        for (JsonNode m : team) {
            if (m.path("email").asText().equals(manager.user().path("email").asText())) {
                managerId = m.path("id").asText();
            }
            if (m.path("email").asText().equals(staff.user().path("email").asText())) {
                staffId = m.path("id").asText();
            }
        }
        assertThat(managerId).isNotNull();
        assertThat(code(call(manager, "PATCH", "/api/businesses/" + NITA_GADGET_ID + "/members/" + staffId,
                Map.of("role", "MANAGER")))).isEqualTo("FORBIDDEN");
        assertThat(code(call(owner, "PATCH", "/api/businesses/" + NITA_GADGET_ID + "/members/" + staffId,
                Map.of("role", "OWNER")))).isEqualTo("VALIDATION_FAILED");
        assertThat(call(owner, "PATCH", "/api/businesses/" + NITA_GADGET_ID + "/members/" + managerId,
                Map.of("role", "STAFF")).path("data").path("role").asText()).isEqualTo("STAFF");

        // Removed (deactivated): the workspace is closed to them at once.
        assertThat(code(call(owner, "PATCH", "/api/businesses/" + NITA_GADGET_ID + "/members/" + staffId,
                Map.of("active", false)))).isEqualTo("SUCCESS");
        assertThat(code(call(staff, "GET", "/api/businesses/" + NITA_GADGET_ID, null))).isEqualTo("FORBIDDEN_TENANT");
        assertThat(roleIn(call(staff, "GET", "/api/me/businesses", null), NITA_GADGET_ID)).isNull();
    }

    @Test
    void a_calendar_member_without_a_login_gets_one_from_an_invite() throws Exception {
        Session owner = login(DANA, DEMO_PASSWORD);
        JsonNode team = call(owner, "GET", "/api/businesses/" + GLOW_BEAUTY_ID + "/members", null).path("data");
        String memberId = null;
        String name = null;
        for (JsonNode m : team) {
            if (!m.hasNonNull("userId") && m.path("role").asText().equals("STAFF") && m.path("active").asBoolean()) {
                memberId = m.path("id").asText();
                name = m.path("name").asText();
                break;
            }
        }
        assertThat(memberId).isNotNull();
        JsonNode inv = call(owner, "POST", "/api/businesses/" + GLOW_BEAUTY_ID + "/invites",
                Map.of("email", uniqueEmail("stylist"), "role", "STAFF", "memberId", memberId));
        assertThat(inv.path("data").path("name").asText()).isEqualTo(name);

        JsonNode preview = call(null, "GET", "/api/join/" + token(inv), null).path("data");
        assertThat(preview.path("businessName").asText()).isEqualTo("Glow Beauty Salon");
        assertThat(preview.path("businessType").asText()).isEqualTo("SERVICE");
        assertThat(preview.path("accountExists").asBoolean()).isFalse();
        assertThat(code(call(null, "POST", "/api/join/" + token(inv) + "/accept", Map.of("password", "weak"))))
                .isEqualTo("VALIDATION_FAILED");
        Session stylist = session(mvc.perform(postJson("/api/join/" + token(inv) + "/accept",
                Map.of("password", PASS))).andReturn());
        assertThat(roleIn(call(stylist, "GET", "/api/me/businesses", null), GLOW_BEAUTY_ID)).isEqualTo("STAFF");

        // The same member now has the login (no duplicate on the calendar).
        JsonNode after = call(owner, "GET", "/api/businesses/" + GLOW_BEAUTY_ID + "/members", null).path("data");
        int withName = 0;
        for (JsonNode m : after) {
            if (m.path("id").asText().equals(memberId)) {
                assertThat(m.path("userId").asText()).isEqualTo(stylist.user().path("id").asText());
            }
            if (m.path("name").asText().equals(name)) {
                withName++;
            }
        }
        assertThat(withName).isEqualTo(1);
        assertThat(code(call(null, "GET", "/api/join/" + token(inv), null))).isEqualTo("INVITE_EXPIRED");
    }

    @Test
    void an_existing_account_confirms_its_password_and_invites_can_be_withdrawn() throws Exception {
        Session owner = login(NITA, DEMO_PASSWORD);
        String email = uniqueEmail("existing");
        signUp("Sok Existing", email, "Bright#2026");
        JsonNode inv = call(owner, "POST", "/api/businesses/" + NITA_GADGET_ID + "/invites",
                Map.of("email", email, "role", "STAFF"));
        assertThat(call(null, "GET", "/api/join/" + token(inv), null).path("data").path("accountExists").asBoolean())
                .isTrue();
        assertThat(code(call(null, "POST", "/api/join/" + token(inv) + "/accept", Map.of("password", "Wrong#2026"))))
                .isEqualTo("INVALID_CREDENTIALS");
        Session joined = session(mvc.perform(postJson("/api/join/" + token(inv) + "/accept",
                Map.of("password", "Bright#2026"))).andReturn());
        assertThat(roleIn(call(joined, "GET", "/api/me/businesses", null), NITA_GADGET_ID)).isEqualTo("STAFF");
        assertThat(code(call(owner, "POST", "/api/businesses/" + NITA_GADGET_ID + "/invites",
                Map.of("email", email, "role", "STAFF")))).isEqualTo("CONFLICT");

        JsonNode other = call(owner, "POST", "/api/businesses/" + NITA_GADGET_ID + "/invites",
                Map.of("email", uniqueEmail("gone"), "role", "STAFF"));
        String id = other.path("data").path("id").asText();
        assertThat(call(owner, "GET", "/api/businesses/" + NITA_GADGET_ID + "/invites", null).path("data").toString())
                .contains(id);
        assertThat(code(call(owner, "DELETE", "/api/businesses/" + NITA_GADGET_ID + "/invites/" + id, null)))
                .isEqualTo("SUCCESS");
        assertThat(code(call(null, "GET", "/api/join/" + token(other), null))).isEqualTo("INVITE_EXPIRED");
        // Someone outside the shop can't see its invites.
        Session dana = login(DANA, DEMO_PASSWORD);
        assertThat(code(call(dana, "GET", "/api/businesses/" + NITA_GADGET_ID + "/invites", null)))
                .isEqualTo("FORBIDDEN_TENANT");
    }
}
