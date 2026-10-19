package com.kosign.vbiz.admin.payload;

import jakarta.validation.constraints.Size;

/** {@code POST /api/admin/orders/{number}/refund}: why, and whether the items go back on the shelf. */
public record RefundInput(@Size(max = 300) String reason, boolean restock) {
}
