package com.kosign.vbiz.account;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.Map;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import com.kosign.vbiz.support.IntegrationTest;

class AccountIntegrationTest extends IntegrationTest {

    private static final String PASSWORD = "Str0ng!Pass";

    @Test
    void seeded_user_has_two_addresses_home_default() throws Exception {
        Session nita = login(NITA, DEMO_PASSWORD);
        mvc.perform(get("/api/me/addresses").header("Authorization", nita.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].label").value("HOME"))
                .andExpect(jsonPath("$.data[0].isDefault").value(true))
                .andExpect(jsonPath("$.data[0].line").value("#12, St. 516"))
                .andExpect(jsonPath("$.data[1].label").value("WORK"))
                .andExpect(jsonPath("$.data[1].isDefault").value(false));
    }

    @Test
    void profile_prefs_and_password() throws Exception {
        String email = uniqueEmail("me");
        Session s = signUp("Me User", email, PASSWORD);
        String phone = uniquePhone();
        mvc.perform(patch("/api/me").header("Authorization", s.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("name", "  New Name ", "phone", "+855" + phone.substring(1)))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("New Name"))
                .andExpect(jsonPath("$.data.phone").value(phone));
        mvc.perform(patch("/api/me").header("Authorization", s.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"0968189261\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.details[0].field").value("phone"));

        mvc.perform(put("/api/me/prefs").header("Authorization", s.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"deals\":false,\"promos\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.deals").value(false))
                .andExpect(jsonPath("$.data.promos").value(true));
        mvc.perform(get("/api/me").header("Authorization", s.bearer()))
                .andExpect(jsonPath("$.data.prefs.promos").value(true))
                .andExpect(jsonPath("$.data.prefs.topics.STOCK.email").value(true))
                .andExpect(jsonPath("$.data.prefs.topics.STOCK.push").value(true));
        // Per topic and channel; topics left out stay as they are.
        mvc.perform(put("/api/me/prefs").header("Authorization", s.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"deals\":false,\"promos\":true,\"topics\":{\"STOCK\":{\"email\":false,\"push\":true}}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.topics.STOCK.email").value(false))
                .andExpect(jsonPath("$.data.topics.STOCK.push").value(true))
                .andExpect(jsonPath("$.data.topics.ORDERS.email").value(true));
        mvc.perform(put("/api/me/prefs").header("Authorization", s.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"deals\":false,\"promos\":true}"))
                .andExpect(jsonPath("$.data.topics.STOCK.email").value(false));

        mvc.perform(post("/api/me/password").header("Authorization", s.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("currentPassword", "nope", "newPassword", "An0ther!Pw"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status.code").value("INVALID_CREDENTIALS"))
                .andExpect(jsonPath("$.error.details[0].field").value("currentPassword"));
        mvc.perform(post("/api/me/password").header("Authorization", s.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("currentPassword", PASSWORD, "newPassword", "weak"))))
                .andExpect(jsonPath("$.status.code").value("VALIDATION_FAILED"));
        mvc.perform(post("/api/me/password").header("Authorization", s.bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("currentPassword", PASSWORD, "newPassword", "An0ther!Pw"))))
                .andExpect(status().isOk());
        login(email, "An0ther!Pw");
    }

    @Test
    void address_default_rules() throws Exception {
        Session s = signUp("Addr User", uniqueEmail("addr"), PASSWORD);
        String auth = s.bearer();

        // first address is always the default, even when isDefault=false
        String first = body(mvc.perform(post("/api/me/addresses").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(
                                address("HOME", "#1, St. 1", "toul-kork", false))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.isDefault").value(true))
                .andExpect(jsonPath("$.data.district").value("Toul Kork"))
                .andExpect(jsonPath("$.data.lat").value(11.5711))
                .andReturn()).path("data").path("id").asText();

        // second, not default
        String second = body(mvc.perform(post("/api/me/addresses").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(
                                address("WORK", "Tower 9", "Daun Penh", null))))
                .andExpect(jsonPath("$.data.isDefault").value(false))
                .andReturn()).path("data").path("id").asText();

        // third as default takes over
        String third = body(mvc.perform(post("/api/me/addresses").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(
                                address("OTHER", "Mum's", "BKK1", true))))
                .andExpect(jsonPath("$.data.isDefault").value(true))
                .andReturn()).path("data").path("id").asText();
        mvc.perform(get("/api/me/addresses").header("Authorization", auth))
                .andExpect(jsonPath("$.data[0].id").value(third))
                .andExpect(jsonPath("$.data[?(@.isDefault == true)]", Matchers.hasSize(1)));

        // make the second default
        mvc.perform(post("/api/me/addresses/" + second + "/default").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(second))
                .andExpect(jsonPath("$.data[0].isDefault").value(true))
                .andExpect(jsonPath("$.data[?(@.isDefault == true)]", Matchers.hasSize(1)));

        // update: switch default via PUT
        mvc.perform(put("/api/me/addresses/" + first).header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(
                                address("HOME", "#1B, St. 1", "Toul Kork", true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.line").value("#1B, St. 1"))
                .andExpect(jsonPath("$.data.isDefault").value(true));

        // deleting the default promotes the oldest remaining one (second)
        mvc.perform(delete("/api/me/addresses/" + first).header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].id").value(second))
                .andExpect(jsonPath("$.data[0].isDefault").value(true));

        // another user's address is not found
        Session nita = login(NITA, DEMO_PASSWORD);
        mvc.perform(delete("/api/me/addresses/" + second).header("Authorization", nita.bearer()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status.code").value("ADDRESS_NOT_FOUND"));

        // validation
        mvc.perform(post("/api/me/addresses").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(
                                address("HOME", "x", "Atlantis", null))))
                .andExpect(jsonPath("$.status.code").value("DISTRICT_NOT_FOUND"));
    }

    private static Map<String, Object> address(String label, String line, String district, Boolean isDefault) {
        Map<String, Object> m = new HashMap<>();
        m.put("label", label);
        m.put("name", "Receiver");
        m.put("phone", "012 345 678");
        m.put("line", line);
        m.put("district", district);
        m.put("note", "Gate");
        m.put("lat", 11.5711);
        m.put("lng", 104.8912);
        if (isDefault != null) {
            m.put("isDefault", isDefault);
        }
        return m;
    }
}
