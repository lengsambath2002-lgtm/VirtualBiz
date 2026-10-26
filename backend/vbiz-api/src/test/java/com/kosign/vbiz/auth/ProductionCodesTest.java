package com.kosign.vbiz.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

import com.kosign.vbiz.support.IntegrationTest;

/**
 * With codes not exposed (any public server): a code is never in a reply, so nobody can sign in to
 * or reset someone else's account from the API, and phone sign-in is off without an SMS provider.
 */
@TestPropertySource(properties = { "vbiz.otp.expose-dev-code=false", "vbiz.staff.expose-dev-links=false" })
class ProductionCodesTest extends IntegrationTest {

    @Test
    void codes_are_sent_never_returned() throws Exception {
        mvc.perform(postJson("/api/auth/signup",
                Map.of("name", "Real World", "email", uniqueEmail("real"), "password", "Real#World2026")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.expiresAt").exists())
                .andExpect(jsonPath("$.data.devCode").doesNotExist());
        mvc.perform(postJson("/api/auth/otp", Map.of("purpose", "LOGIN", "to", NITA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.devCode").doesNotExist());
        mvc.perform(postJson("/api/auth/otp", Map.of("purpose", "RESET", "to", NITA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.devCode").doesNotExist());
    }

    @Test
    void phone_sign_in_is_off_without_an_sms_provider() throws Exception {
        mvc.perform(get("/api/auth/methods")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.phone").value(false));
        mvc.perform(postJson("/api/auth/otp", Map.of("purpose", "PHONE", "to", uniquePhone())))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status.code").value("NOT_CONFIGURED"));
    }
}
