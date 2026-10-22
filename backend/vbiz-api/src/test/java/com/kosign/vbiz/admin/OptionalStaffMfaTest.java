package com.kosign.vbiz.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.time.Instant;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.common.security.Totp;
import com.kosign.vbiz.support.IntegrationTest;

/**
 * Two-step sign-in while it's optional ({@code vbiz.staff.mfa-required=false}, the default): staff
 * sign in with their password alone; staff who turned it on are still asked for a code.
 */
class OptionalStaffMfaTest extends IntegrationTest {

    private static final String STRONG = "Console#Pass2026";

    @Autowired
    JdbcTemplate jdbc;

    private JsonNode call(Session s, String method, String path, Object body) throws Exception {
        var req = method.equals("GET") ? get(path) : post(path);
        req.header("Authorization", s.bearer());
        if (body != null) {
            req.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        }
        return body(mvc.perform(req).andReturn());
    }

    private static String code(JsonNode r) {
        return r.path("status").path("code").asText();
    }

    @Test
    void staff_open_the_console_with_a_password_and_opting_in_still_asks_for_a_code() throws Exception {
        String email = uniqueEmail("opt");
        signUp("Optional Staff", email, STRONG);
        jdbc.update("UPDATE users SET platform_role = 'SUPER_ADMIN' WHERE email = ?", email);
        Session s = login(email, STRONG);
        assertThat(code(call(s, "GET", "/api/admin/overview", null))).isEqualTo("SUCCESS");

        // Turned on by choice: from the next sign-in, the console asks for a code again.
        String secret = call(s, "POST", "/api/staff/security/mfa/setup", null).path("data").path("secret").asText();
        long step = Totp.step(Instant.now().getEpochSecond());
        assertThat(code(call(s, "POST", "/api/staff/security/mfa/enable",
                Map.of("code", Totp.code(secret, step))))).isEqualTo("SUCCESS");
        Session next = login(email, STRONG);
        assertThat(code(call(next, "GET", "/api/admin/overview", null))).isEqualTo("MFA_REQUIRED");
        assertThat(code(call(next, "POST", "/api/staff/security/mfa/verify",
                Map.of("code", Totp.code(secret, step + 1))))).isEqualTo("SUCCESS");
        assertThat(code(call(next, "GET", "/api/admin/overview", null))).isEqualTo("SUCCESS");
    }
}
