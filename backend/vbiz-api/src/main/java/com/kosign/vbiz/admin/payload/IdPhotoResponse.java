package com.kosign.vbiz.admin.payload;

import java.time.Instant;

/** The shop's ID photo for the verification check, inline as a data URL (staff only). */
public record IdPhotoResponse(String contentType, int size, String dataUrl, Instant uploadedAt) {
}
