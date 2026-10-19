package com.kosign.vbiz.account.payload;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.kosign.vbiz.account.domain.AddressLabel;

/** {@code Address} on the wire. */
public record AddressResponse(
        String id,
        String userId,
        AddressLabel label,
        String name,
        String phone,
        String line,
        String district,
        String note,
        Double lat,
        Double lng,
        @JsonProperty("isDefault") boolean isDefault) {
}
