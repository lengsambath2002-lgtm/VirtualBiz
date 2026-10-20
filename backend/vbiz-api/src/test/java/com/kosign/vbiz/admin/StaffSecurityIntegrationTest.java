package com.kosign.vbiz.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.common.security.Totp;
import com.kosign.vbiz.support.IntegrationTest;

/** Staff two-step sign-in, invites and resets (docs/api/phase9-staff-security.md), enforced. */
@TestPropertySource(properties = "vbiz.staff.mfa-required=true")
class StaffSecurityIntegrationTest extends IntegrationTest {

    private static final String STRONG = "Console#Pass2026";
    private static final Map<String, Long> LAST_STEP = new HashMap<>();

    @Autowired
    JdbcTemplate jdbc;

    private JsonNode call(Session s, String method, String path, Object body) throws Exception {
        var req = switch (method) {
            case "GET" -> get(path);
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

    /** A code for a step not used yet (now, or the next one within the allowed drift). */
    private static String totp(String secret) {
        long now = Totp.step(Instant.now().getEpochSecond());
        long step = Math.max(now, LAST_STEP.getOrDefault(secret, Long.MIN_VALUE) + 1);
        LAST_STEP.put(secret, step);
        return Totp.code(secret, step);
    }

    /** A fresh account made staff directly in the database (as an invite or bootstrap would). */
    private Session newStaff(String role) throws Exception {
        String email = uniqueEmail("staff");
        Session s = signUp("Staff Person", email, STRONG);
        jdbc.update("UPDATE users SET platform_role = ? WHERE email = ?", role, email);
        return login(email, STRONG);
    }

    /** Sets up two-step sign-in for {@code s}; returns the key. */
    private String enrol(Session s) throws Exception {
        JsonNode setup = call(s, "POST", "/api/staff/security/mfa/setup", null).path("data");
        String secret = setup.path("secret").asText();
        assertThat(setup.path("otpauthUri").asText()).startsWith("otpauth://totp/VirtualBiz:");
        JsonNode codes = call(s, "POST", "/api/staff/security/mfa/enable", Map.of("code", totp(secret)));
        assertThat(code(codes)).isEqualTo("SUCCESS");
        return secret;
    }

    @Test
    void staff_set_up_two_step_sign_in_and_pass_it_on_every_sign_in() throws Exception {
        Session s = newStaff("ADMIN");
        String email = s.user().path("email").asText();
        assertThat(code(call(s, "GET", "/api/admin/overview", null))).isEqualTo("MFA_SETUP_REQUIRED");
        assertThat(call(s, "GET", "/api/staff/security", null).path("data").path("enrolled").asBoolean()).isFalse();

        JsonNode setup = call(s, "POST", "/api/staff/security/mfa/setup", null).path("data");
        String secret = setup.path("secret").asText();
        // Starting again (a reload, a second tab) shows the same unfinished key.
        assertThat(call(s, "POST", "/api/staff/security/mfa/setup", null).path("data").path("secret").asText())
                .isEqualTo(secret);
        assertThat(code(call(s, "POST", "/api/staff/security/mfa/enable", Map.of("code", "000000"))))
                .isEqualTo("MFA_CODE_INVALID");
        JsonNode enabled = call(s, "POST", "/api/staff/security/mfa/enable", Map.of("code", totp(secret)));
        assertThat(enabled.path("data").path("codes").size()).isEqualTo(10);
        String recovery = enabled.path("data").path("codes").get(0).asText();
        // Enabling passes this sign-in's check.
        assertThat(code(call(s, "GET", "/api/admin/overview", null))).isEqualTo("SUCCESS");
        // The key is sealed at rest.
        assertThat(jdbc.queryForObject("SELECT mfa_secret FROM users WHERE email = ?", String.class, email))
                .startsWith("v1:").doesNotContain(secret);

        // A new sign-in asks again; a used code can't be replayed.
        Session again = login(email, STRONG);
        assertThat(code(call(again, "GET", "/api/admin/overview", null))).isEqualTo("MFA_REQUIRED");
        String used = Totp.code(secret, LAST_STEP.get(secret));
        assertThat(code(call(again, "POST", "/api/staff/security/mfa/verify", Map.of("code", used))))
                .isEqualTo("MFA_CODE_INVALID");
        JsonNode ok = call(again, "POST", "/api/staff/security/mfa/verify", Map.of("code", totp(secret)));
        assertThat(ok.path("data").path("verified").asBoolean()).isTrue();
        assertThat(code(call(again, "GET", "/api/admin/overview", null))).isEqualTo("SUCCESS");

        // A recovery code works once.
        Session third = login(email, STRONG);
        assertThat(code(call(third, "POST", "/api/staff/security/mfa/verify",
                Map.of("recoveryCode", recovery.toLowerCase().replace("-", " "))))).isEqualTo("SUCCESS");
        assertThat(call(third, "GET", "/api/staff/security", null).path("data").path("recoveryCodesLeft").asInt())
                .isEqualTo(9);
        Session fourth = login(email, STRONG);
        assertThat(code(call(fourth, "POST", "/api/staff/security/mfa/verify", Map.of("recoveryCode", recovery))))
                .isEqualTo("MFA_CODE_INVALID");
    }

    @Test
    void five_wrong_codes_sign_the_session_out() throws Exception {
        Session s = newStaff("ADMIN");
        enrol(s);
        Session next = login(s.user().path("email").asText(), STRONG);
        for (int i = 1; i <= 4; i++) {
            JsonNode r = call(next, "POST", "/api/staff/security/mfa/verify", Map.of("code", "123456"));
            assertThat(code(r)).isEqualTo("MFA_CODE_INVALID");
            assertThat(r.path("error").path("details").get(0).path("meta").path("attemptsLeft").asInt())
                    .isEqualTo(5 - i);
        }
        assertThat(code(call(next, "POST", "/api/staff/security/mfa/verify", Map.of("code", "123456"))))
                .isEqualTo("MFA_LOCKED");
        assertThat(code(call(next, "GET", "/api/staff/security", null))).isEqualTo("UNAUTHORIZED");
    }

    @Test
    void a_super_admin_invites_staff_who_join_with_a_strong_password() throws Exception {
        Session boss = newStaff("SUPER_ADMIN");
        enrol(boss);
        String email = uniqueEmail("invitee");
        JsonNode inv = call(boss, "POST", "/api/admin/staff/invites",
                Map.of("email", email.toUpperCase(), "name", "Chan Dara", "role", "ADMIN")).path("data");
        assertThat(inv.path("email").asText()).isEqualTo(email);
        String token = inv.path("devLink").asText().replace("/staff-invite/", "");

        JsonNode preview = call(null, "GET", "/api/staff-invites/" + token, null).path("data");
        assertThat(preview.path("accountExists").asBoolean()).isFalse();
        assertThat(preview.path("role").asText()).isEqualTo("ADMIN");

        JsonNode weak = call(null, "POST", "/api/staff-invites/" + token + "/accept", Map.of("password", "Short#1a"));
        assertThat(code(weak)).isEqualTo("VALIDATION_FAILED");
        MvcResult joined = mvc.perform(postJson("/api/staff-invites/" + token + "/accept",
                Map.of("name", "Chan Dara", "password", STRONG))).andReturn();
        Session dara = session(joined);
        assertThat(dara.user().path("platformRole").asText()).isEqualTo("ADMIN");
        assertThat(code(call(dara, "GET", "/api/admin/overview", null))).isEqualTo("MFA_SETUP_REQUIRED");
        assertThat(code(call(null, "GET", "/api/staff-invites/" + token, null))).isEqualTo("INVITE_EXPIRED");

        JsonNode team = call(boss, "GET", "/api/admin/staff", null).path("data");
        boolean found = false;
        for (JsonNode m : team) {
            if (m.path("email").asText().equals(email)) {
                found = true;
                assertThat(m.path("mfaEnabled").asBoolean()).isFalse();
            }
        }
        assertThat(found).isTrue();
        JsonNode log = call(boss, "GET", "/api/admin/audit?q=" + email, null).path("data").path("items");
        assertThat(log.toString()).contains("STAFF_INVITED");
    }

    @Test
    void an_existing_account_confirms_its_password_and_a_weak_one_must_change() throws Exception {
        Session boss = newStaff("SUPER_ADMIN");
        enrol(boss);
        String email = uniqueEmail("customer");
        signUp("Sok Customer", email, "Bright#2026");
        String token = call(boss, "POST", "/api/admin/staff/invites",
                Map.of("email", email, "name", "Sok Customer", "role", "ADMIN")).path("data").path("devLink").asText()
                .replace("/staff-invite/", "");
        assertThat(call(null, "GET", "/api/staff-invites/" + token, null).path("data").path("accountExists")
                .asBoolean()).isTrue();
        assertThat(code(call(null, "POST", "/api/staff-invites/" + token + "/accept",
                Map.of("password", "Wrong#2026x")))).isEqualTo("INVALID_CREDENTIALS");
        Session joined = session(mvc.perform(postJson("/api/staff-invites/" + token + "/accept",
                Map.of("password", "Bright#2026"))).andReturn());
        assertThat(code(call(joined, "GET", "/api/admin/overview", null))).isEqualTo("PASSWORD_CHANGE_REQUIRED");
        assertThat(code(call(joined, "POST", "/api/me/password",
                Map.of("currentPassword", "Bright#2026", "newPassword", "Better#26")))).isEqualTo("VALIDATION_FAILED");
        assertThat(code(call(joined, "POST", "/api/me/password",
                Map.of("currentPassword", "Bright#2026", "newPassword", STRONG)))).isEqualTo("SUCCESS");
        assertThat(code(call(joined, "GET", "/api/admin/overview", null))).isEqualTo("MFA_SETUP_REQUIRED");
    }

    @Test
    void a_super_admin_resets_a_lost_phone_and_withdraws_invites() throws Exception {
        Session boss = newStaff("SUPER_ADMIN");
        enrol(boss);
        Session helper = newStaff("ADMIN");
        enrol(helper);
        String helperId = helper.user().path("id").asText();
        assertThat(code(call(boss, "POST", "/api/admin/staff/" + helperId + "/mfa/reset", Map.of("reason", "x"))))
                .isEqualTo("VALIDATION_FAILED");
        assertThat(code(call(boss, "POST", "/api/admin/staff/" + helperId + "/mfa/reset",
                Map.of("reason", "Lost phone")))).isEqualTo("SUCCESS");
        // Their sessions ended; on the next sign-in they set it up again.
        assertThat(code(call(helper, "GET", "/api/staff/security", null))).isEqualTo("UNAUTHORIZED");
        Session back = login(helper.user().path("email").asText(), STRONG);
        assertThat(code(call(back, "GET", "/api/admin/overview", null))).isEqualTo("MFA_SETUP_REQUIRED");
        // An admin (not super) can't invite or reset.
        Session admin2 = newStaff("ADMIN");
        enrol(admin2);
        assertThat(code(call(admin2, "POST", "/api/admin/staff/invites",
                Map.of("email", uniqueEmail("x"), "name", "Nope", "role", "ADMIN")))).isEqualTo("SUPER_ADMIN_ONLY");

        JsonNode inv = call(boss, "POST", "/api/admin/staff/invites",
                Map.of("email", uniqueEmail("gone"), "name", "Gone Soon", "role", "SUPER_ADMIN")).path("data");
        String token = inv.path("devLink").asText().replace("/staff-invite/", "");
        assertThat(code(call(boss, "DELETE", "/api/admin/staff/invites/" + inv.path("id").asText(), null)))
                .isEqualTo("SUCCESS");
        assertThat(code(call(null, "GET", "/api/staff-invites/" + token, null))).isEqualTo("INVITE_EXPIRED");
        assertThat(code(call(null, "GET", "/api/staff-invites/not-a-token", null))).isEqualTo("INVITE_NOT_FOUND");
    }
}
