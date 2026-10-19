package com.kosign.vbiz.support;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.Cookie;

/** Spring Boot + MockMvc against the vbiz_test database (local Postgres on 5433). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(CleanTestDatabase.class)
public abstract class IntegrationTest {

    protected static final String DEMO_PASSWORD = "Demo@1234";
    protected static final String NITA = "nita@virtualbiz.com";
    protected static final String DANA = "hello@glowbeauty.com.kh";
    protected static final String NITA_GADGET_ID = "22222222-2222-4222-8222-000000000001";
    protected static final String GLOW_BEAUTY_ID = "22222222-2222-4222-8222-000000000002";

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected ObjectMapper json;

    /** A unique email so tests never collide. */
    protected static String uniqueEmail(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
    }

    /** A unique valid phone 09XXXXXXXX. */
    protected static String uniquePhone() {
        long n = Math.abs(UUID.randomUUID().getMostSignificantBits()) % 100_000_000L;
        return String.format("09%08d", n);
    }

    protected MockHttpServletRequestBuilder postJson(String path, Object body) throws Exception {
        return post(path).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
    }

    protected JsonNode body(MvcResult r) throws Exception {
        return json.readTree(r.getResponse().getContentAsString());
    }

    /** Signed-in session: access token and the refresh cookie. */
    protected record Session(String accessToken, Cookie refresh, JsonNode user) {
        public String bearer() {
            return "Bearer " + accessToken;
        }
    }

    protected Session login(String email, String password) throws Exception {
        MvcResult r = mvc.perform(postJson("/api/auth/login", Map.of("email", email, "password", password)))
                .andExpect(status().isOk()).andReturn();
        return session(r);
    }

    protected Session session(MvcResult r) throws Exception {
        JsonNode data = body(r).path("data");
        return new Session(data.path("accessToken").asText(), r.getResponse().getCookie("vb_refresh"), data.path("user"));
    }

    /** Sign up + verify a fresh password account. */
    protected Session signUp(String name, String email, String password) throws Exception {
        MvcResult sent = mvc.perform(postJson("/api/auth/signup",
                Map.of("name", name, "email", email, "password", password)))
                .andExpect(status().isOk()).andReturn();
        String code = body(sent).path("data").path("devCode").asText();
        MvcResult verified = mvc.perform(postJson("/api/auth/signup/verify", Map.of("email", email, "code", code)))
                .andExpect(status().isOk()).andReturn();
        return session(verified);
    }
}
