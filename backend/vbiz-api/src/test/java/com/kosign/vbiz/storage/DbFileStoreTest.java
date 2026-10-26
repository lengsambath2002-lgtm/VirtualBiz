package com.kosign.vbiz.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;

import com.kosign.vbiz.support.IntegrationTest;

/** {@code vbiz.storage.type=db}: uploads live in {@code file_blob}, not on disk (Render's free plan). */
@TestPropertySource(properties = "vbiz.storage.type=db")
class DbFileStoreTest extends IntegrationTest {

    private static final byte[] PNG = java.util.Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void an_upload_is_kept_in_the_database_and_served_back() throws Exception {
        Session s = signUp("Db Store", uniqueEmail("db"), "Bright#2026");
        String url = body(mvc.perform(multipart("/api/files")
                .file(new MockMultipartFile("file", "a.png", "image/png", PNG))
                .param("purpose", "AVATAR").header("Authorization", s.bearer())).andReturn())
                .path("data").path("url").asText();
        String id = url.substring(url.lastIndexOf('/') + 1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM file_blob b JOIN stored_file f "
                + "ON f.storage_key = b.storage_key WHERE f.id = ?::uuid", Integer.class, id)).isEqualTo(1);
        mvc.perform(get(url)).andExpect(status().isOk()).andExpect(content().bytes(PNG));
    }
}
