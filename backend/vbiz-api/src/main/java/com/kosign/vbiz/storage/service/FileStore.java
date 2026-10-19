package com.kosign.vbiz.storage.service;

import java.io.IOException;

/**
 * Where file bytes live. {@link LocalFileStore} writes to disk; an S3-compatible store (MinIO)
 * can implement the same two calls for a multi-instance deployment.
 */
public interface FileStore {

    void put(String key, byte[] bytes, String contentType) throws IOException;

    /** The bytes, or null when the key is unknown. */
    byte[] get(String key) throws IOException;
}
