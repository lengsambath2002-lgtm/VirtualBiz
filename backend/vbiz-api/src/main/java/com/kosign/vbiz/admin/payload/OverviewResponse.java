package com.kosign.vbiz.admin.payload;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * {@code GET /api/admin/overview?days=7|30|90}. GMV = placed online orders that were not cancelled
 * or returned (USD); commission = VirtualBiz's share of paid online payments. {@code current} is the
 * last {@code rangeDays} days including today, {@code previous} the same length before it; the
 * series, top shops and categories cover {@code current}. Days are Phnom Penh dates.
 */
public record OverviewResponse(
        int rangeDays,
        Period today,
        Period current,
        Period previous,
        Counts counts,
        Queues queues,
        List<DayPoint> days,
        List<TopShop> topShops,
        List<CategorySales> categories) {

    public record Period(BigDecimal gmv, long orders, BigDecimal commission, long bookings, long newUsers,
            long newShops) {
    }

    public record Counts(long users, long shops, long productShops, long serviceShops, long listings) {
    }

    /** What is waiting for staff. */
    public record Queues(long pendingVerifications, long stuckOrders, BigDecimal payoutsDue, long payoutShops,
            long suspendedShops, long suspendedUsers, long lowReviews7d, long categoryRequests) {
    }

    public record DayPoint(LocalDate date, BigDecimal gmv, long orders) {
    }

    public record TopShop(String id, String name, String type, String logoUrl, BigDecimal gmv, long orders) {
    }

    /** Sales of shops in one platform category. */
    public record CategorySales(String id, String name, String nameKh, BigDecimal gmv, long orders) {
    }
}
