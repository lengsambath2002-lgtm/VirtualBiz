package com.kosign.vbiz.meta.payload;

import java.time.Instant;

/** The homepage's main banner and the two beside it; {@code updatedAt/By} only in responses. */
public record HomeBanners(HomeBanner main, HomeBanner side1, HomeBanner side2, Instant updatedAt,
        String updatedBy) {
}
