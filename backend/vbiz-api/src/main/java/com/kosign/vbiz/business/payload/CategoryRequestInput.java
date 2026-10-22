package com.kosign.vbiz.business.payload;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code POST /api/category-requests}: the category a shop is missing, and why. */
public record CategoryRequestInput(@NotBlank @Size(min = 2, max = 40) String name, @Size(max = 40) String nameKh,
        @Size(max = 300) String note) {
}
