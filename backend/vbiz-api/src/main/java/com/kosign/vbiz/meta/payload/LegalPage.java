package com.kosign.vbiz.meta.payload;

import java.time.Instant;

/**
 * The Terms or Privacy page in English and Khmer. Plain text: "## " starts a heading, "- " a
 * bullet, a blank line a paragraph. {@code updatedAt/By} only in responses.
 */
public record LegalPage(String en, String kh, Instant updatedAt, String updatedBy) {
}
