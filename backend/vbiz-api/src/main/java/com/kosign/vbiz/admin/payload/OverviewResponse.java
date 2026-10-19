package com.kosign.vbiz.admin.payload;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * {@code GET /api/admin/overview}. GMV = placed online orders that were not cancelled or returned
 * (USD); commission = VirtualBiz's share of paid online payments. Days are Phnom Penh dates.
 */
public record OverviewResponse(
        Period today,
        Period last7,
        Period last30,
        Period previous30,
        Counts counts,
        Queues queues,
        List<DayPoint> days,
        List<TopShop> topShops) {

    public record Period(BigDecimal gmv, long orders, BigDecimal commission, long bookings, long newUsers,
            long newShops) {
    }

    public record Counts(long users, long shops, long productShops, long serviceShops, long listings) {
    }

    /** What is waiting for staff. */
    public record Queues(long pendingVerifications, long stuckOrders, BigDecimal payoutsDue, long payoutShops,
            long suspendedShops, long suspendedUsers, long lowReviews7d) {
    }

    public record DayPoint(LocalDate date, BigDecimal gmv, long orders) {
    }

    public record TopShop(String id, String name, String type, String logoUrl, BigDecimal gmv, long orders) {
    }
}
