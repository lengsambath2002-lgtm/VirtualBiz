package com.kosign.vbiz.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.support.IntegrationTest;

/** Image uploads, profile and cover photos, optional payout details (docs/api/phase6-files-profiles.md). */
class FileIntegrationTest extends IntegrationTest {

    /** A 1×1 PNG. */
    static final byte[] PNG = java.util.Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");

    private JsonNode upload(Session s, String purpose, byte[] bytes, String name) throws Exception {
        MvcResult r = mvc.perform(multipart("/api/files").file(new MockMultipartFile("file", name, "image/png", bytes))
                .param("purpose", purpose).header("Authorization", s.bearer())).andReturn();
        return body(r);
    }

    @Test
    void upload_serve_and_use_as_avatar_and_cover() throws Exception {
        Session me = signUp("Pic Owner", uniqueEmail("pic"), "Bright#2026");
        JsonNode f = upload(me, "AVATAR", PNG, "me.png").path("data");
        String url = f.path("url").asText();
        assertThat(url).startsWith("/api/files/");
        assertThat(f.path("contentType").asText()).isEqualTo("image/png");

        // Served to anyone, as the image itself, cached for good.
        byte[] got = mvc.perform(get(url)).andExpect(status().isOk())
                .andExpect(header().string("Content-Type", org.hamcrest.Matchers.startsWith("image/png")))
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("immutable")))
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(got).isEqualTo(PNG);

        String cover = upload(me, "USER_COVER", PNG, "cover.png").path("data").path("url").asText();
        JsonNode user = body(mvc.perform(patch("/api/me").header("Authorization", me.bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("avatarUrl", url, "coverUrl", cover)))).andReturn()).path("data");
        assertThat(user.path("avatarUrl").asText()).isEqualTo(url);
        assertThat(user.path("coverUrl").asText()).isEqualTo(cover);
        assertThat(body(mvc.perform(get("/api/me").header("Authorization", me.bearer())).andReturn())
                .path("data").path("coverUrl").asText()).isEqualTo(cover);

        // A cover is not an avatar; someone else's image is not yours; an outside URL is refused.
        JsonNode wrong = body(mvc.perform(patch("/api/me").header("Authorization", me.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("avatarUrl", cover))))
                .andReturn());
        assertThat(wrong.path("status").path("code").asText()).isEqualTo("VALIDATION_FAILED");
        Session other = signUp("Other", uniqueEmail("other"), "Bright#2026");
        JsonNode theft = body(mvc.perform(patch("/api/me").header("Authorization", other.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("avatarUrl", url))))
                .andReturn());
        assertThat(theft.path("status").path("code").asText()).isEqualTo("VALIDATION_FAILED");
        JsonNode outside = body(mvc.perform(patch("/api/me").header("Authorization", me.bearer())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("avatarUrl", "https://evil.example/x.png")))).andReturn());
        assertThat(outside.path("status").path("code").asText()).isEqualTo("VALIDATION_FAILED");

        // Empty removes it.
        JsonNode cleared = body(mvc.perform(patch("/api/me").header("Authorization", me.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("coverUrl", ""))))
                .andReturn()).path("data");
        assertThat(cleared.path("coverUrl").isMissingNode() || cleared.path("coverUrl").isNull()).isTrue();
    }

    @Test
    void only_real_images_and_only_signed_in() throws Exception {
        Session me = signUp("Pic Owner", uniqueEmail("pic"), "Bright#2026");
        JsonNode bad = upload(me, "AVATAR", "<svg onload=alert(1)>".getBytes(), "x.png");
        assertThat(bad.path("status").path("code").asText()).isEqualTo("UNSUPPORTED_FILE");
        mvc.perform(multipart("/api/files").file(new MockMultipartFile("file", "a.png", "image/png", PNG))
                .param("purpose", "AVATAR")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/files/" + java.util.UUID.randomUUID())).andExpect(status().isNotFound());
    }

    @Test
    void a_business_without_payout_details_then_logo_and_cover() throws Exception {
        Session s = signUp("New Owner", uniqueEmail("owner"), "Bright#2026");
        Map<String, Object> req = new HashMap<>();
        req.put("type", "PRODUCT");
        req.put("name", "No Payout Yet");
        req.put("categoryId", "grocery");
        req.put("district", "Toul Kork");
        req.put("street", "#1, St. 2");
        req.put("phone", "012 345 678");
        req.put("hours", Map.of("open", "08:00", "close", "18:00", "sunday", false));
        JsonNode b = body(mvc.perform(post("/api/businesses").header("Authorization", s.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(req)))
                .andExpect(status().isCreated()).andReturn()).path("data");
        String id = b.path("id").asText();
        assertThat(b.path("bakongId").isMissingNode() || b.path("bakongId").isNull()).isTrue();

        String logo = upload(s, "BUSINESS_LOGO", PNG, "logo.png").path("data").path("url").asText();
        String cover = upload(s, "BUSINESS_COVER", PNG, "cover.png").path("data").path("url").asText();
        JsonNode patched = body(mvc.perform(patch("/api/businesses/" + id).header("Authorization", s.bearer())
                .header("X-Business-Id", id).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("logoUrl", logo, "coverUrl", cover, "bakongId", "noyet@aba"))))
                .andReturn()).path("data");
        assertThat(patched.path("logoUrl").asText()).isEqualTo(logo);
        assertThat(patched.path("coverUrl").asText()).isEqualTo(cover);
        assertThat(patched.path("bakongId").asText()).isEqualTo("noyet@aba");

        // The marketplace shows them.
        JsonNode shop = body(mvc.perform(get("/api/marketplace/shops/" + b.path("slug").asText())).andReturn())
                .path("data");
        assertThat(shop.toString()).contains(logo).contains(cover);
    }
}
