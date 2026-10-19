package com.kosign.vbiz.account.payload;

import jakarta.validation.constraints.Size;

/**
 * {@code PATCH /api/me}. A null field is left unchanged; an empty phone removes it. {@code avatarUrl}
 * and {@code coverUrl} take the URL of an image the user uploaded ({@code POST /api/files}); empty
 * removes it.
 */
public record UpdateMeRequest(
        @Size(min = 1, max = 80) String name,
        @Size(max = 20) String phone,
        @Size(max = 500) String avatarUrl,
        @Size(max = 500) String coverUrl) {
}
