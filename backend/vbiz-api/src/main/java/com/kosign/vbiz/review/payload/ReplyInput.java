package com.kosign.vbiz.review.payload;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** {@code POST /api/reviews/{id}/reply}: the shop's public reply; empty removes it. */
public record ReplyInput(@NotNull @Size(max = 1000) String text) {
}
