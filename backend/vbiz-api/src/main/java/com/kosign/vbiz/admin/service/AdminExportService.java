package com.kosign.vbiz.admin.service;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.admin.domain.AuditTarget;
import com.kosign.vbiz.admin.payload.AdminBusinessRow;
import com.kosign.vbiz.admin.payload.AdminOrderRow;
import com.kosign.vbiz.admin.payload.AdminReviewRow;
import com.kosign.vbiz.admin.payload.AdminUserRow;
import com.kosign.vbiz.admin.payload.AuditEntry;
import com.kosign.vbiz.admin.payload.PayoutResponse;
import com.kosign.vbiz.admin.payload.ListParams;
import com.kosign.vbiz.admin.repository.AdminQueries;
import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.domain.VerificationStatus;
import com.kosign.vbiz.common.csv.CsvWriter;
import com.kosign.vbiz.common.list.DayRange;

import lombok.RequiredArgsConstructor;

/**
 * CSV exports of console lists (docs/api/phase15-lists.md): the list exactly as filtered and
 * sorted, every page, up to {@link #MAX_ROWS} rows. Each export is in the audit log with its
 * filters and row count.
 */
@Service
@RequiredArgsConstructor
public class AdminExportService {

    public static final int MAX_ROWS = 50_000;

    private final AdminAccess access;
    private final AdminQueries queries;
    private final AuditLog audit;
    private final AdminBusinessService businesses;
    private final java.time.Clock clock;

    public record Csv(String filename, byte[] bytes, int rows) {
    }

    @Transactional
    public Csv businesses(String q, BusinessType type, VerificationStatus verification, String status,
            String category, String district, ListParams lp) {
        AdminAccess.Admin by = access.require();
        AdminQueries.BusinessFilter f = AdminBusinessService.filter(q, type, verification, status, category,
                district, lp);
        CsvWriter csv = new CsvWriter("Shop", "Slug", "Type", "Category", "District", "Owner", "Owner contact",
                "Verification", "Status", "Rating", "Reviews", "Orders (30 days)", "Sales 30 days (USD)", "Joined");
        for (AdminBusinessRow b : queries.businesses(f, businesses.recentSince(), 0, MAX_ROWS).items()) {
            csv.row(b.name(), b.slug(), b.type(), b.categoryId(), b.district(), b.ownerName(), b.ownerContact(),
                    b.verification(), b.suspendedAt() != null ? "SUSPENDED" : b.online() ? "ONLINE" : "OFFLINE",
                    b.rating(), b.reviewCount(), b.orders30(), b.gmv30(), b.createdAt());
        }
        return done(by, "shops", csv, f.joined(), filters("q", f.q(), "type", f.type(), "verification",
                f.verification(), "status", f.status(), "category", f.category(), "district", f.district(),
                "sort", f.sort()));
    }

    @Transactional
    public Csv users(String q, String kind, String status, ListParams lp) {
        AdminAccess.Admin by = access.require();
        AdminQueries.UserFilter f = new AdminQueries.UserFilter(q, kind, status, lp.range(), lp.sort());
        CsvWriter csv = new CsvWriter("Name", "Email", "Phone", "Staff role", "Shops", "Orders", "Spent (USD)",
                "Status", "Joined");
        for (AdminUserRow u : queries.users(f, 0, MAX_ROWS).items()) {
            csv.row(u.name(), u.email(), u.phone(), u.platformRole(), u.businesses(), u.orders(), u.spent(),
                    u.suspendedAt() == null ? "ACTIVE" : "SUSPENDED", u.createdAt());
        }
        return done(by, "users", csv, f.joined(), filters("q", f.q(), "kind", f.kind(), "status", f.status(),
                "sort", f.sort()));
    }

    @Transactional
    public Csv orders(String q, String status, UUID businessId, UUID customerId, String method, String pay,
            ListParams lp) {
        AdminAccess.Admin by = access.require();
        AdminQueries.OrderFilter f = new AdminQueries.OrderFilter(q, status, businessId, customerId, method, pay,
                lp.range(), lp.sort());
        CsvWriter csv = new CsvWriter("Order", "Placed", "Status", "Shop", "Customer", "Fulfilment", "Payment",
                "Payment status", "Total (USD)", "Cancel reason");
        for (AdminOrderRow o : queries.orders(f, 0, MAX_ROWS).items()) {
            csv.row(o.number(), o.at(), o.status(), o.shopName(), o.customerName(), o.method(), o.paymentMethod(),
                    o.paymentStatus(), o.total(), o.cancelReason());
        }
        return done(by, "orders", csv, f.placed(), filters("q", f.q(), "status", f.status(), "businessId",
                f.businessId(), "customerId", f.customerId(), "method", f.method(), "payMethod", f.payMethod(),
                "sort", f.sort()));
    }

    @Transactional
    public Csv reviews(String q, Integer stars, String status, UUID businessId, String replied, ListParams lp) {
        AdminAccess.Admin by = access.require();
        AdminQueries.ReviewFilter f = new AdminQueries.ReviewFilter(q, stars, status, businessId, null, replied,
                lp.range(), lp.sort());
        CsvWriter csv = new CsvWriter("Date", "Shop", "Item", "Author", "Stars", "Review", "Reply", "Verified buyer",
                "Hidden", "Hidden reason");
        for (AdminReviewRow r : queries.reviews(f, 0, MAX_ROWS).items()) {
            csv.row(r.at(), r.shopName(), r.itemName(), r.authorName(), r.stars(), r.text(), r.reply(), r.verified(),
                    r.hiddenAt() != null, r.hiddenReason());
        }
        return done(by, "reviews", csv, f.at(), filters("q", f.q(), "stars", f.stars(), "status", f.status(),
                "businessId", f.businessId(), "replied", f.replied(), "sort", f.sort()));
    }

    @Transactional
    public Csv payouts(String q, UUID businessId, ListParams lp) {
        AdminAccess.Admin by = access.require();
        AdminQueries.PayoutFilter f = new AdminQueries.PayoutFilter(q, businessId, lp.range(), lp.sort());
        CsvWriter csv = new CsvWriter("Paid", "Shop", "Gross (USD)", "Commission (USD)", "Paid out (USD)", "Payments",
                "Bakong ID", "Reference", "Note", "Paid by");
        for (PayoutResponse p : queries.payouts(f, 0, MAX_ROWS).items()) {
            csv.row(p.paidAt(), p.shopName(), p.gross(), p.commission(), p.amount(), p.payments(), p.bakongId(),
                    p.reference(), p.note(), p.paidByName());
        }
        return done(by, "payouts", csv, f.paid(), filters("q", f.q(), "businessId", f.businessId(), "sort",
                f.sort()));
    }

    @Transactional
    public Csv audit(String q, String targetType, String targetId, String action, ListParams lp) {
        AdminAccess.Admin by = access.require();
        AdminQueries.AuditFilter f = new AdminQueries.AuditFilter(q, targetType, targetId, action, lp.range());
        CsvWriter csv = new CsvWriter("Time", "Who", "Action", "Target type", "Target", "Target id", "Reason",
                "Details");
        for (AuditEntry a : queries.audit(f, 0, MAX_ROWS).items()) {
            csv.row(a.at(), a.actorName(), a.action(), a.targetType(), a.targetLabel(), a.targetId(), a.reason(),
                    a.details() == null || a.details().isEmpty() ? null
                            : a.details().entrySet().stream().map(e -> e.getKey() + "=" + e.getValue())
                                    .collect(Collectors.joining("; ")));
        }
        return done(by, "audit", csv, f.at(), filters("q", f.q(), "targetType", f.targetType(), "targetId",
                f.targetId(), "action", f.action()));
    }

    private Csv done(AdminAccess.Admin by, String list, CsvWriter csv, DayRange range, Map<String, Object> filters) {
        if (range != null) {
            filters.put("from", range.from());
            filters.put("to", range.to());
        }
        filters.values().removeIf(v -> v == null);
        filters.put("rows", csv.rows());
        audit.record(by, AuditLog.DATA_EXPORTED, AuditTarget.EXPORT, list, "Export: " + list, null, filters);
        String day = LocalDate.now(clock.withZone(CsvWriter.PHNOM_PENH)).toString();
        return new Csv("virtualbiz-" + list + "-" + day + ".csv", csv.bytes(), csv.rows());
    }

    private static Map<String, Object> filters(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            Object v = kv[i + 1];
            m.put((String) kv[i], v == null || (v instanceof String s && s.isBlank()) ? null : String.valueOf(v));
        }
        return m;
    }
}
