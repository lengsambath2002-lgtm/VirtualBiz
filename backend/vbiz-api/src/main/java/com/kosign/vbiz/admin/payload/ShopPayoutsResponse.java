package com.kosign.vbiz.admin.payload;

import java.util.List;

/**
 * {@code GET /api/payouts} (a shop's own view): what VirtualBiz holds for it now and the latest
 * transfers. {@code balance} is null when no online payment has come in yet.
 */
public record ShopPayoutsResponse(PayoutBalance balance, List<PayoutResponse> payouts, int releaseDays,
        int commissionPct) {
}
