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

    @org.springframework.beans.factory.annotation.Autowired
    org.springframework.jdbc.core.JdbcTemplate jdbc;

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

    @Test
    void several_people_are_invited_by_email_alone_and_refused_ones_are_reported() throws Exception {
        Session owner = login(NITA, DEMO_PASSWORD);
        String a = uniqueEmail("many");
        String b = uniqueEmail("many");
        JsonNode r = call(owner, "POST", "/api/businesses/" + NITA_GADGET_ID + "/invites/batch",
                Map.of("emails", java.util.List.of(a, " " + b.toUpperCase() + " ", b, "not-an-email", NITA),
                        "role", "STAFF"));
        assertThat(code(r)).isEqualTo("SUCCESS");
        JsonNode d = r.path("data");
        // The same address twice is sent once; the name waits for the person to join.
        assertThat(d.path("sent").size()).isEqualTo(2);
        assertThat(d.path("sent").get(0).path("email").asText()).isEqualTo(a);
        assertThat(d.path("sent").get(0).path("name").asText()).isEqualTo(a.substring(0, a.indexOf('@')));
        assertThat(d.path("failed").size()).isEqualTo(2);
        assertThat(d.path("failed").get(0).path("email").asText()).isEqualTo("not-an-email");
        assertThat(d.path("failed").get(0).path("code").asText()).isEqualTo("VALIDATION_FAILED");
        assertThat(d.path("failed").get(1).path("code").asText()).isEqualTo("CONFLICT");

        // Each invite works on its own: the second person joins with their own name.
        Session joined = session(mvc.perform(postJson("/api/join/"
                + d.path("sent").get(1).path("devLink").asText().replace("/join/", "") + "/accept",
                Map.of("name", "Second Person", "password", PASS))).andReturn());
        assertThat(roleIn(call(joined, "GET", "/api/me/businesses", null), NITA_GADGET_ID)).isEqualTo("STAFF");

        // More than 20 at once is refused outright.
        assertThat(call(owner, "POST", "/api/businesses/" + NITA_GADGET_ID + "/invites/batch",
                Map.of("emails", java.util.Collections.nCopies(21, uniqueEmail("x")), "role", "STAFF"))
                .path("status").path("code").asText()).isEqualTo("VALIDATION_FAILED");
    }

    @Test
    void the_invite_box_names_who_an_email_means_without_listing_strangers() throws Exception {
        Session owner = login(NITA, DEMO_PASSWORD);
        String path = "/api/businesses/" + NITA_GADGET_ID + "/invites/lookup?q=";

        // Typing part of an address finds the shop's own customers…
        JsonNode tena = call(owner, "GET", path + "tena", null).path("data");
        assertThat(tena.get(0).path("email").asText()).isEqualTo("tena.heng@gmail.com");
        assertThat(tena.get(0).path("source").asText()).isEqualTo("CUSTOMER");
        assertThat(tena.get(0).path("name").asText()).isEqualTo("Tena Heng");

        // …but never other VirtualBiz accounts: those match on the whole address only.
        assertThat(call(owner, "GET", path + "admin@virtual", null).path("data").size()).isZero();
        JsonNode admin = call(owner, "GET", path + "ADMIN@virtualbiz.com", null).path("data");
        assertThat(admin.get(0).path("source").asText()).isEqualTo("ACCOUNT");
        assertThat(admin.get(0).path("onTeam").asBoolean()).isFalse();

        // Someone already on the team is marked so; wildcards are text, not patterns.
        assertThat(call(owner, "GET", path + NITA, null).path("data").get(0).path("onTeam").asBoolean()).isTrue();
        assertThat(call(owner, "GET", path + "%25%25", null).path("data").size()).isZero();

        // Staff can't use it.
        Session staff = join(owner, NITA_GADGET_ID, "STAFF", Map.of());
        assertThat(code(call(staff, "GET", path + "tena", null))).isEqualTo("FORBIDDEN");
    }

    /** Makes an account sign in with email codes only, as one made by an email code or Google is. */
    private void codeOnly(String email) {
        jdbc.update("update users set password_hash = null where email = ?", email);
        jdbc.update("delete from user_sign_in_method where user_id = (select id from users where email = ?)", email);
        jdbc.update("insert into user_sign_in_method (user_id, method) select id, 'EMAIL_CODE' from users where email = ?",
                email);
    }

    @Test
    void an_account_without_a_password_is_told_so_joins_with_a_new_one_and_can_set_one() throws Exception {
        String email = uniqueEmail("nopw");
        Session own = signUp("Dara Codeonly", email, PASS);
        codeOnly(email);

        // A password attempt says there is none (not "wrong") and never locks the account.
        for (int n = 0; n < 7; n++) {
            JsonNode r = body(mvc.perform(postJson("/api/auth/login", Map.of("email", email, "password", "Anything#1")))
                    .andReturn());
            assertThat(code(r)).isEqualTo("INVALID_CREDENTIALS");
            assertThat(r.path("error").path("details").get(0).path("meta").path("reason").asText())
                    .isEqualTo("NO_PASSWORD");
        }

        // Invited, the join page knows the account and its own name, and the password chosen there works.
        Session owner = login(NITA, DEMO_PASSWORD);
        JsonNode inv = call(owner, "POST", "/api/businesses/" + NITA_GADGET_ID + "/invites",
                Map.of("email", email, "role", "STAFF"));
        JsonNode preview = call(null, "GET", "/api/join/" + token(inv), null).path("data");
        assertThat(preview.path("accountExists").asBoolean()).isTrue();
        assertThat(preview.path("accountHasPassword").asBoolean()).isFalse();
        assertThat(preview.path("name").asText()).isEqualTo("Dara Codeonly");
        Session joined = session(mvc.perform(postJson("/api/join/" + token(inv) + "/accept",
                Map.of("password", PASS))).andReturn());
        assertThat(roleIn(call(joined, "GET", "/api/me/businesses", null), NITA_GADGET_ID)).isEqualTo("STAFF");
        assertThat(login(email, PASS)).isNotNull();

        // From My settings, a code-only account sets a first password without a current one.
        String other = uniqueEmail("nopw2");
        Session mine = signUp("Sok Codeonly", other, PASS);
        codeOnly(other);
        assertThat(code(call(mine, "POST", "/api/me/password", Map.of("newPassword", "Fresh#Pass2026"))))
                .isEqualTo("SUCCESS");
        assertThat(login(other, "Fresh#Pass2026")).isNotNull();
        assertThat(own).isNotNull();
    }

    @Test
    void a_signed_in_account_accepts_with_one_click_and_anyone_with_the_link_can_decline() throws Exception {
        Session owner = login(NITA, DEMO_PASSWORD);
        String email = uniqueEmail("click");
        Session them = signUp("Mony Click", email, PASS);
        String invites = "/api/businesses/" + NITA_GADGET_ID + "/invites";

        // Accept while signed in as the invited email: no password, the shop is theirs with the role.
        JsonNode inv = call(owner, "POST", invites, Map.of("email", email, "role", "MANAGER"));
        Session other = signUp("Someone Else", uniqueEmail("other"), PASS);
        JsonNode wrong = call(other, "POST", "/api/me/invites/" + token(inv) + "/accept", null);
        assertThat(code(wrong)).isEqualTo("FORBIDDEN");
        JsonNode joined = call(them, "POST", "/api/me/invites/" + token(inv) + "/accept", null).path("data");
        assertThat(joined.path("businessId").asText()).isEqualTo(NITA_GADGET_ID);
        assertThat(joined.path("role").asText()).isEqualTo("MANAGER");
        assertThat(roleIn(call(them, "GET", "/api/me/businesses", null), NITA_GADGET_ID)).isEqualTo("MANAGER");
        assertThat(code(call(them, "POST", "/api/me/invites/" + token(inv) + "/accept", null)))
                .isEqualTo("INVITE_EXPIRED");

        // Decline: the invite closes, leaves the pending list, and the shop's log says who said no.
        String no = uniqueEmail("no");
        JsonNode inv2 = call(owner, "POST", invites, Map.of("email", no, "role", "STAFF"));
        assertThat(code(call(null, "POST", "/api/join/" + token(inv2) + "/decline", null))).isEqualTo("SUCCESS");
        assertThat(code(call(null, "GET", "/api/join/" + token(inv2), null))).isEqualTo("INVITE_EXPIRED");
        assertThat(call(owner, "GET", invites, null).toString()).doesNotContain(no);
        assertThat(jdbc.queryForObject(
                "select count(*) from shop_activity where business_id = ?::uuid and action = 'TEAM_INVITE_DECLINED' and target_label = ?",
                Integer.class, NITA_GADGET_ID, no)).isEqualTo(1);
    }
}
