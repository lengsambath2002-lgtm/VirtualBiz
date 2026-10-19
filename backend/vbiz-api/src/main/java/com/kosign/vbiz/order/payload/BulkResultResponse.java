package com.kosign.vbiz.order.payload;

import java.util.List;

/** Bulk accept / pack / ship: the orders changed and the ids that were skipped (wrong status). */
public record BulkResultResponse(List<OrderResponse> orders, List<String> skipped) {
}
