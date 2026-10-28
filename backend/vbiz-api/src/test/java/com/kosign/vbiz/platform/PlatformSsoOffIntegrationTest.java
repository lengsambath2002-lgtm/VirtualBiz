package com.kosign.vbiz.platform;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.support.IntegrationTest;

/** Without the client secret (or id, or URL) platform sign-in is off: hidden, and NOT_CONFIGURED. */
@TestPropertySource(properties = { "vbiz.platform.client-secret=", "spring.datasource.hikari.maximum-pool-size=2" })
class PlatformSsoOffIntegrationTest extends IntegrationTest {

    @Test
    void the_feature_is_off_without_its_settings() throws Exception {
        assertThat(body(mvc.perform(get("/api/auth/methods")).andReturn()).path("data").path("platform").asBoolean())
                .isFalse();
        JsonNode start = body(mvc.perform(postJson("/api/auth/platform/start", Map.of("intent", "signin"))).andReturn());
        assertThat(start.path("status").path("code").asText()).isEqualTo("NOT_CONFIGURED");
        JsonNode complete = body(mvc.perform(postJson("/api/auth/platform/complete",
                Map.of("code", "c", "state", "s"))).andReturn());
        assertThat(complete.path("status").path("code").asText()).isEqualTo("NOT_CONFIGURED");

        Session nita = login(NITA, DEMO_PASSWORD);
        JsonNode connect = body(mvc.perform(postJson("/api/businesses/" + NITA_GADGET_ID + "/platform/connect",
                Map.of("orgId", "3f0c8a8e-1b7e-4a53-9a1f-0d6f3d1c2b4a")).header("Authorization", nita.bearer()))
                .andReturn());
        assertThat(connect.path("status").path("code").asText()).isEqualTo("NOT_CONFIGURED");
        JsonNode status = body(mvc.perform(get("/api/businesses/" + NITA_GADGET_ID + "/platform")
                .header("Authorization", nita.bearer())).andReturn());
        assertThat(status.path("data").path("available").asBoolean()).isFalse();
        assertThat(status.path("data").path("linked").asBoolean()).isFalse();
    }
}
