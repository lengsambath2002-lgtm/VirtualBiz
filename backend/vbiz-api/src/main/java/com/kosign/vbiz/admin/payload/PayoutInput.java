package com.kosign.vbiz.admin.payload;

import java.util.UUID;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** {@code POST /api/admin/payouts}: record that the shop's payable balance was transferred. */
public record PayoutInput(@NotNull UUID businessId, @Size(max = 80) String reference, @Size(max = 300) String note) {
}
