package com.kosign.vbiz.customer.payload;

import java.time.Instant;

/** {@code Client} on the wire (docs/api/phase4-bookings-provider.md § Shapes). */
public record ClientResponse(
        String id,
        String businessId,
        String name,
        String phone,
        String email,
        String note,
        String district,
        Instant since,
        String userId) {
}
