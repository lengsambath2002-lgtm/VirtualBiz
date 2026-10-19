package com.kosign.vbiz.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import com.kosign.vbiz.support.IntegrationTest;

import jakarta.servlet.http.Cookie;

class AuthFlowIntegrationTest extends IntegrationTest {

    private static final String PASSWORD = "Str0ng!Pass";

    @Test
    void signup_verify_then_me() throws Exception {
        String email = uniqueEmail("signup");
        MvcResult sent = mvc.perform(postJson("/api/auth/signup",
                        Map.of("name", "Sok Dara", "email", email.toUpperCase(), "password", PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.devCode").value(Matchers.matchesPattern("\\d{6}")))
                .andExpect(jsonPath("$.data.expiresAt").exists())
                .andExpect(jsonPath("$.data.resendAt").exists())
                .andReturn();
        String code = body(sent).path("data").path("devCode").asText();

        // wrong code first: OTP_INVALID with triesLeft
        String wrong = code.equals("000000") ? "111111" : "000000";
        mvc.perform(postJson("/api/auth/signup/verify", Map.of("email", email, "code", wrong)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status.code").value("OTP_INVALID"))
                .andExpect(jsonPath("$.error.details[0].meta.triesLeft").value(4));

        MvcResult verified = mvc.perform(postJson("/api/auth/signup/verify", Map.of("email", email, "code", code)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.expiresIn").value(900))
                .andExpect(jsonPath("$.data.user.email").value(email))
                .andExpect(jsonPath("$.data.user.name").value("Sok Dara"))
                .andExpect(jsonPath("$.data.user.signInMethods[0]").value("PASSWORD"))
                .andExpect(header().string("Set-Cookie", Matchers.allOf(
                        Matchers.containsString("vb_refresh="), Matchers.containsString("Path=/api/auth"),
                        Matchers.containsString("HttpOnly"), Matchers.containsString("SameSite=Lax"),
                        Matchers.containsString("Max-Age=2592000"))))
                .andReturn();
        Session s = session(verified);

        mvc.perform(get("/api/me").header("Authorization", s.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value(email))
                .andExpect(jsonPath("$.data.prefs.deals").value(true))
                .andExpect(jsonPath("$.data.prefs.promos").value(false));

        // the code is single use
        mvc.perform(postJson("/api/auth/signup/verify", Map.of("email", email, "code", code)))
                .andExpect(jsonPath("$.status.code").value("OTP_EXPIRED"));
        // and the email is now taken
        mvc.perform(postJson("/api/auth/signup", Map.of("name", "X", "email", email, "password", PASSWORD)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status.code").value("CONFLICT"))
                .andExpect(jsonPath("$.error.details[0].field").value("email"));
    }

    @Test
    void signup_rejects_weak_password_and_resend_too_soon() throws Exception {
        String email = uniqueEmail("weak");
        mvc.perform(postJson("/api/auth/signup", Map.of("name", "A", "email", email, "password", "short")))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.status.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.error.details[0].field").value("password"));
        String local = email.substring(0, email.indexOf('@'));
        mvc.perform(postJson("/api/auth/signup", Map.of("name", "A", "email", email, "password", "Aa1!" + local)))
                .andExpect(jsonPath("$.status.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.error.details[0].meta.rules[0]").value("email"));

        mvc.perform(postJson("/api/auth/signup", Map.of("name", "A", "email", email, "password", PASSWORD)))
                .andExpect(status().isOk());
        mvc.perform(postJson("/api/auth/otp", Map.of("purpose", "VERIFY", "to", email)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.status.code").value("OTP_RESEND_TOO_SOON"))
                .andExpect(jsonPath("$.error.details[0].meta.retryAfter").value(Matchers.both(
                        Matchers.greaterThan(0)).and(Matchers.lessThanOrEqualTo(30))));
    }

    @Test
    void otp_attempts_exceeded_after_five_wrong_codes() throws Exception {
        String email = uniqueEmail("tries");
        MvcResult sent = mvc.perform(postJson("/api/auth/signup",
                Map.of("name", "A", "email", email, "password", PASSWORD))).andReturn();
        String code = body(sent).path("data").path("devCode").asText();
        String wrong = code.equals("000000") ? "111111" : "000000";
        for (int left = 4; left >= 1; left--) {
            mvc.perform(postJson("/api/auth/signup/verify", Map.of("email", email, "code", wrong)))
                    .andExpect(jsonPath("$.error.details[0].meta.triesLeft").value(left));
        }
        mvc.perform(postJson("/api/auth/signup/verify", Map.of("email", email, "code", wrong)))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.status.code").value("OTP_ATTEMPTS_EXCEEDED"));
        // the right code no longer works either
        mvc.perform(postJson("/api/auth/signup/verify", Map.of("email", email, "code", code)))
                .andExpect(jsonPath("$.status.code").value("OTP_ATTEMPTS_EXCEEDED"));
    }

    @Test
    void lookup_reports_methods() throws Exception {
        mvc.perform(postJson("/api/auth/lookup", Map.of("email", "NITA@virtualbiz.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.exists").value(true))
                .andExpect(jsonPath("$.data.methods", Matchers.contains("PASSWORD", "GOOGLE")));
        mvc.perform(postJson("/api/auth/lookup", Map.of("email", uniqueEmail("nobody"))))
                .andExpect(jsonPath("$.data.exists").value(false))
                .andExpect(jsonPath("$.data.methods", Matchers.empty()));
    }

    @Test
    void login_seeded_user_and_wrong_password_lockout() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        assertThat(nita.accessToken()).isNotBlank();
        assertThat(nita.user().path("name").asText()).isEqualTo("Kry Sonita");

        mvc.perform(postJson("/api/auth/login", Map.of("email", uniqueEmail("ghost"), "password", "x")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status.code").value("INVALID_CREDENTIALS"))
                .andExpect(jsonPath("$.error.details[0].meta.reason").value("NO_ACCOUNT"));

        String email = uniqueEmail("lock");
        signUp("Lock Me", email, PASSWORD);
        for (int left = 4; left >= 1; left--) {
            mvc.perform(postJson("/api/auth/login", Map.of("email", email, "password", "Wrong!123")))
                    .andExpect(jsonPath("$.status.code").value("INVALID_CREDENTIALS"))
                    .andExpect(jsonPath("$.error.details[0].meta.reason").value("BAD_PASSWORD"))
                    .andExpect(jsonPath("$.error.details[0].meta.triesLeft").value(left));
        }
        mvc.perform(postJson("/api/auth/login", Map.of("email", email, "password", "Wrong!123")))
                .andExpect(jsonPath("$.status.code").value("ACCOUNT_LOCKED"))
                .andExpect(jsonPath("$.error.details[0].meta.retryAfter").value(30));
        // even the right password is refused while locked
        mvc.perform(postJson("/api/auth/login", Map.of("email", email, "password", PASSWORD)))
                .andExpect(jsonPath("$.status.code").value("ACCOUNT_LOCKED"))
                .andExpect(jsonPath("$.error.details[0].meta.retryAfter").value(Matchers.lessThanOrEqualTo(30)));
    }

    @Test
    void login_with_email_code_adds_method() throws Exception {
        String email = uniqueEmail("code");
        signUp("Code User", email, PASSWORD);
        mvc.perform(postJson("/api/auth/otp", Map.of("purpose", "LOGIN", "to", uniqueEmail("none"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status.code").value("USER_NOT_FOUND"));
        MvcResult sent = mvc.perform(postJson("/api/auth/otp", Map.of("purpose", "LOGIN", "to", email)))
                .andExpect(status().isOk()).andReturn();
        String code = body(sent).path("data").path("devCode").asText();
        mvc.perform(postJson("/api/auth/login/code", Map.of("email", email, "code", code)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.signInMethods", Matchers.contains("PASSWORD", "EMAIL_CODE")));
    }

    @Test
    void password_reset_flow() throws Exception {
        String email = uniqueEmail("reset");
        Session before = signUp("Reset User", email, PASSWORD);
        MvcResult sent = mvc.perform(postJson("/api/auth/otp", Map.of("purpose", "RESET", "to", email)))
                .andExpect(status().isOk()).andReturn();
        String code = body(sent).path("data").path("devCode").asText();
        MvcResult verified = mvc.perform(postJson("/api/auth/password/reset/verify",
                        Map.of("email", email, "code", code)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.resetToken").isNotEmpty())
                .andReturn();
        String token = body(verified).path("data").path("resetToken").asText();

        mvc.perform(postJson("/api/auth/password/reset", Map.of("resetToken", token, "password", "weak")))
                .andExpect(jsonPath("$.status.code").value("VALIDATION_FAILED"));
        // the current password can't be reused, and the rejected try leaves the token usable
        mvc.perform(postJson("/api/auth/password/reset", Map.of("resetToken", token, "password", PASSWORD)))
                .andExpect(jsonPath("$.status.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.error.details[0].field").value("password"));
        mvc.perform(postJson("/api/auth/password/reset", Map.of("resetToken", token, "password", "N3w!Passw0rd")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty());
        mvc.perform(postJson("/api/auth/password/reset", Map.of("resetToken", token, "password", "N3w!Passw0rd")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status.code").value("INVALID_TOKEN"));

        login(email, "N3w!Passw0rd");
        // the old refresh session was revoked by the reset
        mvc.perform(post("/api/auth/refresh").cookie(before.refresh()))
                .andExpect(jsonPath("$.status.code").value("REFRESH_TOKEN_INVALID"));
    }

    @Test
    void phone_new_then_existing() throws Exception {
        String phone = uniquePhone();
        String typed = "+855 " + phone.substring(1);
        mvc.perform(postJson("/api/auth/otp", Map.of("purpose", "PHONE", "to", "12")))
                .andExpect(jsonPath("$.status.code").value("INVALID_PHONE"));
        String code = body(mvc.perform(postJson("/api/auth/otp", Map.of("purpose", "PHONE", "to", typed)))
                .andExpect(status().isOk()).andReturn()).path("data").path("devCode").asText();
        MvcResult fresh = mvc.perform(postJson("/api/auth/phone/verify", Map.of("phone", phone, "code", code)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("NEW"))
                .andExpect(jsonPath("$.data.phoneToken").isNotEmpty())
                .andReturn();
        String phoneToken = body(fresh).path("data").path("phoneToken").asText();

        mvc.perform(postJson("/api/auth/phone/register", Map.of("phoneToken", phoneToken, "name", "Phone User",
                        "email", NITA)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.details[0].field").value("email"));
        mvc.perform(postJson("/api/auth/phone/register", Map.of("phoneToken", phoneToken, "name", "Phone User")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.phone").value(phone))
                .andExpect(jsonPath("$.data.user.email").doesNotExist())
                .andExpect(jsonPath("$.data.user.signInMethods", Matchers.contains("PHONE_SMS")));

        // second time the same number signs in
        String code2 = body(mvc.perform(postJson("/api/auth/otp", Map.of("purpose", "PHONE", "to", phone)))
                .andReturn()).path("data").path("devCode").asText();
        // resend window: the previous code was consumed, so a new one may be sent at once
        mvc.perform(postJson("/api/auth/phone/verify", Map.of("phone", phone, "code", code2)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SIGNED_IN"))
                .andExpect(jsonPath("$.data.session.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.session.user.phone").value(phone))
                .andExpect(header().string("Set-Cookie", Matchers.containsString("vb_refresh=")));
    }

    @Test
    void refresh_rotates_and_reuse_revokes_family() throws Exception {
        Session s = login(NITA, DEMO_PASSWORD);
        MvcResult r1 = mvc.perform(post("/api/auth/refresh").cookie(s.refresh()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.email").value(NITA))
                .andReturn();
        Cookie rotated = r1.getResponse().getCookie("vb_refresh");
        assertThat(rotated.getValue()).isNotEqualTo(s.refresh().getValue());

        // the old token again = reuse: rejected and the whole family revoked
        mvc.perform(post("/api/auth/refresh").cookie(s.refresh()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status.code").value("REFRESH_TOKEN_INVALID"));
        mvc.perform(post("/api/auth/refresh").cookie(rotated))
                .andExpect(jsonPath("$.status.code").value("REFRESH_TOKEN_INVALID"));
        mvc.perform(post("/api/auth/refresh"))
                .andExpect(jsonPath("$.status.code").value("REFRESH_TOKEN_INVALID"));
    }

    @Test
    void logout_and_logout_all() throws Exception {
        Session a = login(DANA, DEMO_PASSWORD);
        Session b = login(DANA, DEMO_PASSWORD);

        mvc.perform(post("/api/auth/logout").cookie(a.refresh()))
                .andExpect(status().isOk())
                .andExpect(header().string("Set-Cookie", Matchers.containsString("Max-Age=0")));
        mvc.perform(post("/api/auth/refresh").cookie(a.refresh()))
                .andExpect(jsonPath("$.status.code").value("REFRESH_TOKEN_INVALID"));

        mvc.perform(post("/api/auth/logout-all"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status.code").value("UNAUTHORIZED"));
        mvc.perform(post("/api/auth/logout-all").header("Authorization", b.bearer()))
                .andExpect(status().isOk());
        mvc.perform(post("/api/auth/refresh").cookie(b.refresh()))
                .andExpect(jsonPath("$.status.code").value("REFRESH_TOKEN_INVALID"));
    }

    @Test
    void google_not_configured_and_dev_stand_in() throws Exception {
        mvc.perform(postJson("/api/auth/google", Map.of("idToken", "abc")))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status.code").value("NOT_CONFIGURED"));
        String email = uniqueEmail("google");
        mvc.perform(postJson("/api/auth/google/dev", Map.of("email", email, "name", "G User")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.signInMethods", Matchers.contains("GOOGLE")));
        // links to an existing account by email
        mvc.perform(postJson("/api/auth/google/dev", Map.of("email", DANA, "name", "ignored")))
                .andExpect(jsonPath("$.data.user.name").value("Try Dana"))
                .andExpect(jsonPath("$.data.user.signInMethods", Matchers.hasItem("GOOGLE")));
    }

    @Test
    void protected_endpoints_need_a_valid_token() throws Exception {
        mvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.common.requestId").exists());
        mvc.perform(get("/api/me").header("Authorization", "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/health")).andExpect(status().isOk());
    }
}
