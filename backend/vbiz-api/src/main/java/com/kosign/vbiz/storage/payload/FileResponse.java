package com.kosign.vbiz.storage.payload;

import com.kosign.vbiz.storage.domain.FilePurpose;

/** An uploaded image: use {@code url} as the avatar, cover, logo or product photo. */
public record FileResponse(String id, String url, FilePurpose purpose, String contentType, int size) {
}
