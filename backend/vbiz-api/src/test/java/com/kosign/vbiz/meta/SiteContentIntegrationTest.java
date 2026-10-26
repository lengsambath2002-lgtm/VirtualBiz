package com.kosign.vbiz.meta;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.kosign.vbiz.support.IntegrationTest;

/** Homepage banners and legal pages: public to read, a super-admin edits them (docs/api/site-content.md). */
class SiteContentIntegrationTest extends IntegrationTest {

    private static final String STRONG = "Console#Pass2026";

    @Autowired
    JdbcTemplate jdbc;

    private Session staff(String role) throws Exception {
        String email = uniqueEmail("content");
        signUp("Content Staff", email, STRONG);
        jdbc.update("UPDATE users SET platform_role = ? WHERE email = ?", role, email);
        return login(email, STRONG);
    }

    private JsonNode send(Session s, String path, Object body) throws Exception {
        return body(mvc.perform(put(path).header("Authorization", s.bearer()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body))).andReturn());
    }

    private static String code(JsonNode r) {
        return r.path("status").path("code").asText();
    }

    @Test
    void anyone_reads_the_homepage_banners_and_a_super_admin_changes_them() throws Exception {
        JsonNode banners = body(mvc.perform(get("/api/meta/home-banners")).andReturn()).path("data");
        assertThat(banners.path("main").path("title").path("en").asText()).contains("local shops");
        assertThat(banners.path("side2").path("href").asText()).isEqualTo("/create-business");

        ObjectNode edit = (ObjectNode) banners.deepCopy();
        ((ObjectNode) edit.path("main").path("title")).put("en", "Khmer New Year deals");
        ((ObjectNode) edit.path("side1")).put("visible", false);

        assertThat(code(send(staff("ADMIN"), "/api/admin/content/home-banners", edit))).isEqualTo("SUPER_ADMIN_ONLY");

        Session boss = staff("SUPER_ADMIN");
        ObjectNode bad = edit.deepCopy();
        ((ObjectNode) bad.path("main")).put("href", "//evil.example");
        JsonNode refused = send(boss, "/api/admin/content/home-banners", bad);
        assertThat(code(refused)).isEqualTo("VALIDATION_FAILED");
        assertThat(refused.path("error").path("details").get(0).path("field").asText()).isEqualTo("main.href");

        JsonNode saved = send(boss, "/api/admin/content/home-banners", edit).path("data");
        assertThat(saved.path("updatedBy").asText()).isEqualTo("Content Staff");
        JsonNode pub = body(mvc.perform(get("/api/meta/home-banners")).andReturn()).path("data");
        assertThat(pub.path("main").path("title").path("en").asText()).isEqualTo("Khmer New Year deals");
        assertThat(pub.path("side1").path("visible").asBoolean()).isFalse();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_audit WHERE action = 'CONTENT_UPDATED' "
                + "AND target_type = 'CONTENT' AND target_id = 'home-banners'", Integer.class)).isPositive();
    }

    @Test
    void terms_and_privacy_have_text_in_both_languages_and_can_be_edited() throws Exception {
        for (String page : new String[] { "terms", "privacy" }) {
            JsonNode p = body(mvc.perform(get("/api/meta/legal/" + page)).andReturn()).path("data");
            assertThat(p.path("en").asText()).contains("## ");
            assertThat(p.path("kh").asText()).isNotBlank();
        }
        assertThat(code(body(mvc.perform(get("/api/meta/legal/cookies")).andReturn()))).isEqualTo("NOT_FOUND");

        Session boss = staff("SUPER_ADMIN");
        assertThat(code(send(boss, "/api/admin/content/legal/terms", java.util.Map.of("en", " ", "kh", "x"))))
                .isEqualTo("VALIDATION_FAILED");
        JsonNode saved = send(boss, "/api/admin/content/legal/terms",
                java.util.Map.of("en", "## New terms\nBe kind.", "kh", "")).path("data");
        assertThat(saved.path("en").asText()).isEqualTo("## New terms\nBe kind.");
        assertThat(body(mvc.perform(get("/api/meta/legal/terms")).andReturn()).path("data").path("en").asText())
                .startsWith("## New terms");
    }
}
