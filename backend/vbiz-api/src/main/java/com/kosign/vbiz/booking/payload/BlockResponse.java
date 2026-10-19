package com.kosign.vbiz.booking.payload;

import com.kosign.vbiz.booking.domain.BlockReason;

/** {@code Block} on the wire. */
public record BlockResponse(String id, String businessId, String staffId, String date, int start, int durationMin,
        BlockReason reason) {
}
