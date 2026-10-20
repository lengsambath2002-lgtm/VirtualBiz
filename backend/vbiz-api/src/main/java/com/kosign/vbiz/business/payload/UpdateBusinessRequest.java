package com.kosign.vbiz.business.payload;

import java.math.BigDecimal;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.business.domain.Closure;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

/**
 * {@code PATCH /api/businesses/{id}}: only the fields present change. An empty {@code about} or
 * {@code email} clears it. {@code hours} is either 7 entries ({@code [openMin, closeMin]} or null,
 * Monday first) or the Create Business form {@code {open, close, sunday}}. {@code productSettings}
 * / {@code bookingSettings} are merged field by field into the current settings. {@code idPhoto}
 * (owner or manager, not once verified) replaces the ID photo and asks for a new check.
 */
public record UpdateBusinessRequest(
        @Size(min = 2, max = 80) String name,
        @Size(max = 40) String categoryId,
        @Size(max = 1000) String about,
        @Size(max = 20) String phone,
        @Size(max = 254) String email,
        @Size(max = 80) String district,
        @Size(min = 3, max = 200) String street,
        @DecimalMin("-90") @DecimalMax("90") BigDecimal lat,
        @DecimalMin("-180") @DecimalMax("180") BigDecimal lng,
        JsonNode hours,
        @Size(max = 366) List<Closure> closures,
        Boolean online,
        @Size(max = 100) String bakongId,
        @Size(max = 500) String logoUrl,
        @Size(max = 500) String coverUrl,
        JsonNode productSettings,
        JsonNode bookingSettings,
        /** Merged field by field into the shop policy (receipt, VAT, payment methods, links). */
        JsonNode policy,
        /** A new ID photo (data URL) while the shop is not verified: it goes back to PENDING. */
        String idPhoto) {
}
