package com.kosign.vbiz.storage.service;

import java.util.List;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;

/**
 * Uploaded bytes in the database ({@code file_blob}), for a host whose disk is wiped on restart
 * (Render's free plan): {@code vbiz.storage.type=db}. Fine for a demo's photos; a busy shop
 * floor wants disk or an S3-compatible store.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "vbiz.storage.type", havingValue = "db")
public class DbFileStore implements FileStore {

    private final JdbcTemplate jdbc;

    @Override
    public void put(String key, byte[] bytes, String contentType) {
        jdbc.update("INSERT INTO file_blob (storage_key, bytes, content_type) VALUES (?, ?, ?) "
                + "ON CONFLICT (storage_key) DO UPDATE SET bytes = EXCLUDED.bytes, content_type = EXCLUDED.content_type",
                key, bytes, contentType);
    }

    @Override
    public byte[] get(String key) {
        List<byte[]> rows = jdbc.query("SELECT bytes FROM file_blob WHERE storage_key = ?",
                (rs, i) -> rs.getBytes(1), key);
        return rows.isEmpty() ? null : rows.get(0);
    }
}
