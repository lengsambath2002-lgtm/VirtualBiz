package com.kosign.vbiz.report.payload;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** {@code POST /api/me/views}: a name for the list's current filters (its URL query). */
public record SavedViewInput(
        @NotBlank @Pattern(regexp = "[a-z][a-zA-Z0-9.-]{1,39}") String list,
        @NotBlank @Size(max = 60) String name,
        @Size(max = 1000) String query) {
}
