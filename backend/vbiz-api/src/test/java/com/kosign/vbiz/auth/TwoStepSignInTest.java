package com.kosign.vbiz.auth;

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

/** Two-step sign-in for every account (docs/api/two-step.md). */
class TwoStepSignInTest extends IntegrationTest {

    private static final String PASSWORD = "Bright#2026";

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

    private JsonNode loginRaw(String email) throws Exception {
        return body(mvc.perform(postJson("/api/auth/login", Map.of("email", email, "password", PASSWORD))).andReturn());
    }

    private static String code(JsonNode r) {
        return r.path("status").path("code").asText();
    }

    private static long step() {
        return Totp.step(Instant.now().getEpochSecond());
    }

    @Test
    void a_customer_turns_it_on_and_every_sign_in_then_asks_for_a_code() throws Exception {
        String email = uniqueEmail("two");
        Session s = signUp("Two Step", email, PASSWORD);
        assertThat(call(s, "GET", "/api/me/two-step", null).path("data").path("enabled").asBoolean()).isFalse();

        String secret = call(s, "POST", "/api/me/two-step/setup", null).path("data").path("secret").asText();
        assertThat(code(call(s, "POST", "/api/me/two-step/enable", Map.of("code", "000000"))))
                .isEqualTo("MFA_CODE_INVALID");
        JsonNode on = call(s, "POST", "/api/me/two-step/enable", Map.of("code", Totp.code(secret, step())));
        assertThat(code(on)).isEqualTo("SUCCESS");
        assertThat(on.path("data").path("codes")).hasSize(10);
        String recovery = on.path("data").path("codes").get(0).asText();

        // The password alone no longer opens the account: a ticket instead of a session.
        JsonNode challenge = loginRaw(email);
        assertThat(code(challenge)).isEqualTo("TWO_STEP_REQUIRED");
        assertThat(challenge.path("data").isMissingNode() || challenge.path("data").isNull()).isTrue();
        String ticket = challenge.path("error").path("details").get(0).path("meta").path("ticket").asText();
        assertThat(ticket).isNotBlank();

        JsonNode wrong = body(mvc.perform(postJson("/api/auth/two-step", Map.of("ticket", ticket, "code", "123456")))
                .andReturn());
        assertThat(code(wrong)).isEqualTo("MFA_CODE_INVALID");
        assertThat(wrong.path("error").path("details").get(0).path("meta").path("attemptsLeft").asInt()).isEqualTo(4);

        String now = Totp.code(secret, step() + 1);
        JsonNode in = body(mvc.perform(postJson("/api/auth/two-step", Map.of("ticket", ticket, "code", now)))
                .andReturn());
        assertThat(code(in)).isEqualTo("SUCCESS");
        assertThat(in.path("data").path("accessToken").asText()).isNotBlank();

        // The ticket is used up, and the same app code can't be used twice.
        assertThat(code(body(mvc.perform(postJson("/api/auth/two-step", Map.of("ticket", ticket, "code", now)))
                .andReturn()))).isEqualTo("INVALID_TOKEN");
        String ticket2 = loginRaw(email).path("error").path("details").get(0).path("meta").path("ticket").asText();
        assertThat(code(body(mvc.perform(postJson("/api/auth/two-step", Map.of("ticket", ticket2, "code", now)))
                .andReturn()))).isEqualTo("MFA_CODE_INVALID");

        // A recovery code works once.
        var viaRecovery = mvc.perform(postJson("/api/auth/two-step",
                Map.of("ticket", ticket2, "recoveryCode", recovery.toLowerCase()))).andReturn();
        assertThat(code(body(viaRecovery))).isEqualTo("SUCCESS");
        Session s2 = session(viaRecovery);
        assertThat(call(s2, "GET", "/api/me/two-step", null).path("data").path("recoveryCodesLeft").asInt())
                .isEqualTo(9);

        // Turning it off takes a code too; then the password signs in again.
        assertThat(code(call(s2, "POST", "/api/me/two-step/disable", Map.of("code", "000000"))))
                .isEqualTo("MFA_CODE_INVALID");
        String recovery2 = on.path("data").path("codes").get(1).asText();
        assertThat(code(call(s2, "POST", "/api/me/two-step/disable", Map.of("recoveryCode", recovery2))))
                .isEqualTo("SUCCESS");
        assertThat(code(loginRaw(email))).isEqualTo("SUCCESS");
    }

    @Test
    void five_wrong_codes_use_the_ticket_up() throws Exception {
        String email = uniqueEmail("lock");
        Session s = signUp("Lock Step", email, PASSWORD);
        String secret = call(s, "POST", "/api/me/two-step/setup", null).path("data").path("secret").asText();
        call(s, "POST", "/api/me/two-step/enable", Map.of("code", Totp.code(secret, step())));
        String ticket = loginRaw(email).path("error").path("details").get(0).path("meta").path("ticket").asText();
        for (int i = 0; i < 4; i++) {
            assertThat(code(body(mvc.perform(postJson("/api/auth/two-step", Map.of("ticket", ticket, "code", "111111")))
                    .andReturn()))).isEqualTo("MFA_CODE_INVALID");
        }
        assertThat(code(body(mvc.perform(postJson("/api/auth/two-step", Map.of("ticket", ticket, "code", "111111")))
                .andReturn()))).isEqualTo("MFA_LOCKED");
        assertThat(code(body(mvc.perform(postJson("/api/auth/two-step",
                Map.of("ticket", ticket, "code", Totp.code(secret, step() + 1)))).andReturn())))
                .isEqualTo("INVALID_TOKEN");
    }

    @Test
    void staff_keep_managing_it_in_the_console() throws Exception {
        String email = uniqueEmail("staff");
        signUp("Console Staff", email, "Console#Pass2026");
        jdbc.update("UPDATE users SET platform_role = 'ADMIN' WHERE email = ?", email);
        Session admin = login(email, "Console#Pass2026");
        JsonNode st = call(admin, "GET", "/api/me/two-step", null);
        assertThat(st.path("data").path("managedInConsole").asBoolean()).isTrue();
        assertThat(code(call(admin, "POST", "/api/me/two-step/setup", null))).isEqualTo("CONFLICT");
    }
}
