package com.kosign.vbiz.admin.payload;

import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

/** One action on up to 100 rows of a console list; {@code reason} as the single action needs it. */
public record BulkInput(@NotEmpty @Size(max = 100) List<UUID> ids, @NotBlank String action,
        @Size(max = 300) String reason) {
}
