package com.kosign.vbiz.admin.repository;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kosign.vbiz.account.domain.PlatformRole;
import com.kosign.vbiz.admin.payload.AdminBusinessDetail;
import com.kosign.vbiz.admin.payload.AdminBusinessRow;
import com.kosign.vbiz.admin.payload.AdminOrderDetail;
import com.kosign.vbiz.admin.payload.AdminOrderRow;
import com.kosign.vbiz.admin.payload.AdminReviewRow;
import com.kosign.vbiz.admin.payload.AdminUserDetail;
import com.kosign.vbiz.admin.payload.AdminUserRow;
import com.kosign.vbiz.admin.payload.AuditEntry;
import com.kosign.vbiz.admin.payload.OverviewResponse;
import com.kosign.vbiz.admin.payload.PageResponse;
import com.kosign.vbiz.admin.payload.PayoutBalance;
import com.kosign.vbiz.admin.payload.PayoutResponse;
import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.domain.VerificationStatus;

import lombok.RequiredArgsConstructor;

/**
 * The console's reads across every shop and account (docs/api/phase7-admin.md): filtered, paged
 * lists, the overview figures and the payout balances, in SQL. Writes go through the entities.
 */
@Repository
@RequiredArgsConstructor
public class AdminQueries {

    /** Orders that count as sales (GMV). */
    private static final String SOLD = "o.placed_at IS NOT NULL AND o.status NOT IN ('CANCELLED', 'RETURNED')";

    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper json;

    // ── Overview ───────────────────────────────────────────────────────────────────────

    public OverviewResponse.Period period(Instant from, Instant to) {
        MapSqlParameterSource p = new MapSqlParameterSource().addValue("from", ts(from)).addValue("to", ts(to));
        return jdbc.queryForObject("""
                SELECT (SELECT COALESCE(sum(o.total), 0) FROM orders o WHERE %1$s AND o.placed_at >= :from AND o.placed_at < :to) gmv,
                       (SELECT count(*) FROM orders o WHERE %1$s AND o.placed_at >= :from AND o.placed_at < :to) orders,
                       (SELECT COALESCE(sum(p.commission), 0) FROM payment p
                         WHERE p.status = 'PAID' AND p.channel = 'ONLINE' AND p.paid_at >= :from AND p.paid_at < :to) commission,
                       (SELECT count(*) FROM appointment a WHERE a.created_at >= :from AND a.created_at < :to
                           AND a.status NOT IN ('CANCELLED', 'DECLINED')) bookings,
                       (SELECT count(*) FROM users u WHERE u.created_at >= :from AND u.created_at < :to) new_users,
                       (SELECT count(*) FROM business b WHERE b.created_at >= :from AND b.created_at < :to) new_shops
                """.formatted(SOLD), p, (rs, i) -> new OverviewResponse.Period(rs.getBigDecimal("gmv"),
                rs.getLong("orders"), rs.getBigDecimal("commission"), rs.getLong("bookings"), rs.getLong("new_users"),
                rs.getLong("new_shops")));
    }

    public OverviewResponse.Counts counts() {
        return jdbc.queryForObject("""
                SELECT (SELECT count(*) FROM users) users,
                       (SELECT count(*) FROM business) shops,
                       (SELECT count(*) FROM business WHERE type = 'PRODUCT') product_shops,
                       (SELECT count(*) FROM business WHERE type = 'SERVICE') service_shops,
                       (SELECT count(*) FROM marketplace_listing) listings
                """, new MapSqlParameterSource(), (rs, i) -> new OverviewResponse.Counts(rs.getLong("users"),
                rs.getLong("shops"), rs.getLong("product_shops"), rs.getLong("service_shops"), rs.getLong("listings")));
    }

    /** Stuck = still NEW after 30 minutes, or accepted / packed more than a day ago. */
    public long[] queueCounts(Instant now) {
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("new", ts(now.minusSeconds(30 * 60)))
                .addValue("day", ts(now.minusSeconds(24 * 3600)))
                .addValue("week", ts(now.minusSeconds(7 * 24 * 3600)));
        return jdbc.queryForObject("""
                SELECT (SELECT count(*) FROM business WHERE verification = 'PENDING') pending,
                       (SELECT count(*) FROM orders WHERE (status = 'NEW' AND placed_at < :new)
                            OR (status IN ('ACCEPTED', 'PACKED') AND placed_at < :day)) stuck,
                       (SELECT count(*) FROM business WHERE suspended_at IS NOT NULL) suspended_shops,
                       (SELECT count(*) FROM users WHERE suspended_at IS NOT NULL) suspended_users,
                       (SELECT count(*) FROM review WHERE stars <= 2 AND hidden_at IS NULL AND at >= :week) low_reviews
                """, p, (rs, i) -> new long[] {rs.getLong("pending"), rs.getLong("stuck"), rs.getLong("suspended_shops"),
                        rs.getLong("suspended_users"), rs.getLong("low_reviews")});
    }

    /** GMV and orders per Phnom Penh day, {@code from}..{@code to} inclusive (days with none are 0). */
    public List<OverviewResponse.DayPoint> days(LocalDate from, LocalDate to) {
        MapSqlParameterSource p = new MapSqlParameterSource().addValue("from", Date.valueOf(from))
                .addValue("to", Date.valueOf(to));
        return jdbc.query("""
                SELECT d.day, COALESCE(sum(o.total), 0) gmv, count(o.id) orders
                  FROM generate_series(CAST(:from AS date), CAST(:to AS date), interval '1 day') AS d(day)
                  LEFT JOIN orders o ON %s AND (o.placed_at AT TIME ZONE 'Asia/Phnom_Penh')::date = d.day::date
                 GROUP BY d.day ORDER BY d.day
                """.formatted(SOLD), p, (rs, i) -> new OverviewResponse.DayPoint(rs.getDate("day").toLocalDate(),
                rs.getBigDecimal("gmv"), rs.getLong("orders")));
    }

    public List<OverviewResponse.TopShop> topShops(Instant from, int limit) {
        MapSqlParameterSource p = new MapSqlParameterSource().addValue("from", ts(from)).addValue("limit", limit);
        return jdbc.query("""
                SELECT b.id, b.name, b.type, b.logo_url, sum(o.total) gmv, count(*) orders
                  FROM orders o JOIN business b ON b.id = o.business_id
                 WHERE %s AND o.placed_at >= :from
                 GROUP BY b.id ORDER BY gmv DESC, b.name LIMIT :limit
                """.formatted(SOLD), p, (rs, i) -> new OverviewResponse.TopShop(rs.getString("id"),
                rs.getString("name"), rs.getString("type"), rs.getString("logo_url"), rs.getBigDecimal("gmv"),
                rs.getLong("orders")));
    }

    // ── Businesses ─────────────────────────────────────────────────────────────────────

    public record BusinessFilter(String q, BusinessType type, VerificationStatus verification, String status,
            String sort) {
    }

    private static final String BUSINESS_ROW = """
            SELECT b.id, b.name, b.slug, b.type, b.category_id, b.district, b.logo_url, b.owner_id,
                   u.name owner_name, COALESCE(u.email, u.phone) owner_contact, b.verification,
                   EXISTS (SELECT 1 FROM business_document d WHERE d.business_id = b.id AND d.kind = 'ID_PHOTO') has_id,
                   b.online, b.suspended_at, b.rating, b.review_count, b.created_at,
                   COALESCE(s.orders, 0) orders30, COALESCE(s.gmv, 0) gmv30
              FROM business b JOIN users u ON u.id = b.owner_id
              LEFT JOIN LATERAL (SELECT count(*) orders, sum(o.total) gmv FROM orders o
                                  WHERE o.business_id = b.id AND %s AND o.placed_at >= :since) s ON TRUE
            """.formatted(SOLD);

    public PageResponse<AdminBusinessRow> businesses(BusinessFilter f, Instant since, int page, int size) {
        Where w = new Where();
        if (notBlank(f.q())) {
            w.and("(b.name ILIKE :q OR b.slug ILIKE :q OR u.name ILIKE :q OR u.email ILIKE :q OR u.phone ILIKE :q"
                    + " OR b.phone ILIKE :q)", "q", like(f.q()));
        }
        if (f.type() != null) {
            w.and("b.type = :type", "type", f.type().name());
        }
        if (f.verification() != null) {
            w.and("b.verification = :ver", "ver", f.verification().name());
        }
        if ("suspended".equals(f.status())) {
            w.and("b.suspended_at IS NOT NULL");
        } else if ("offline".equals(f.status())) {
            w.and("NOT b.online AND b.suspended_at IS NULL");
        } else if ("active".equals(f.status())) {
            w.and("b.online AND b.suspended_at IS NULL");
        }
        String order = switch (f.sort() == null ? "" : f.sort()) {
            case "gmv" -> "gmv30 DESC, b.name";
            case "rating" -> "b.rating DESC, b.review_count DESC, b.name";
            case "name" -> "b.name, b.id";
            // The queue first: shops waiting for their ID check, oldest first.
            case "pending" -> "(b.verification = 'PENDING') DESC, b.created_at ASC";
            default -> "b.created_at DESC, b.id";
        };
        w.p.addValue("since", ts(since));
        long total = jdbc.queryForObject("SELECT count(*) FROM business b JOIN users u ON u.id = b.owner_id"
                + w.sql, w.p, Long.class);
        List<AdminBusinessRow> items = jdbc.query(BUSINESS_ROW + w.sql + " ORDER BY " + order + page(w, page, size),
                w.p, this::businessRow);
        return new PageResponse<>(items, total, page, size);
    }

    public Optional<AdminBusinessRow> business(UUID id, Instant since) {
        MapSqlParameterSource p = new MapSqlParameterSource().addValue("id", id).addValue("since", ts(since));
        return jdbc.query(BUSINESS_ROW + " WHERE b.id = :id", p, this::businessRow).stream().findFirst();
    }

    public AdminBusinessDetail.Stats businessStats(UUID id) {
        MapSqlParameterSource p = new MapSqlParameterSource().addValue("id", id);
        return jdbc.queryForObject("""
                SELECT (SELECT count(*) FROM orders o WHERE o.business_id = :id AND %1$s) orders,
                       (SELECT COALESCE(sum(o.total), 0) FROM orders o WHERE o.business_id = :id AND %1$s) gmv,
                       (SELECT count(*) FROM appointment a WHERE a.business_id = :id
                            AND a.status NOT IN ('CANCELLED', 'DECLINED')) bookings,
                       (SELECT count(*) FROM product WHERE business_id = :id AND deleted_at IS NULL) products,
                       (SELECT count(*) FROM service WHERE business_id = :id AND deleted_at IS NULL) services,
                       (SELECT COALESCE(sum(amount), 0) FROM payout WHERE business_id = :id) paid_out
                """.formatted(SOLD), p, (rs, i) -> new AdminBusinessDetail.Stats(rs.getLong("orders"),
                rs.getBigDecimal("gmv"), rs.getLong("bookings"), rs.getLong("products"), rs.getLong("services"),
                rs.getBigDecimal("paid_out"), BigDecimal.ZERO));
    }

    public List<AdminBusinessDetail.Member> members(UUID businessId) {
        return jdbc.query("""
                SELECT m.user_id, m.name, m.role, m.title, u.email, u.phone, m.active
                  FROM business_member m LEFT JOIN users u ON u.id = m.user_id
                 WHERE m.business_id = :id
                 ORDER BY CASE m.role WHEN 'OWNER' THEN 0 WHEN 'MANAGER' THEN 1 ELSE 2 END, m.name
                """, new MapSqlParameterSource("id", businessId), (rs, i) -> new AdminBusinessDetail.Member(
                rs.getString("user_id"), rs.getString("name"), rs.getString("role"), rs.getString("title"),
                rs.getString("email"), rs.getString("phone"), rs.getBoolean("active")));
    }

    private AdminBusinessRow businessRow(ResultSet rs, int i) throws SQLException {
        return new AdminBusinessRow(rs.getString("id"), rs.getString("name"), rs.getString("slug"),
                BusinessType.valueOf(rs.getString("type")), rs.getString("category_id"), rs.getString("district"),
                rs.getString("logo_url"), rs.getString("owner_id"), rs.getString("owner_name"),
                rs.getString("owner_contact"), VerificationStatus.valueOf(rs.getString("verification")),
                rs.getBoolean("has_id"), rs.getBoolean("online"), instant(rs, "suspended_at"),
                rs.getBigDecimal("rating") == null ? 0 : rs.getBigDecimal("rating").doubleValue(),
                rs.getInt("review_count"), rs.getLong("orders30"), rs.getBigDecimal("gmv30"),
                instant(rs, "created_at"));
    }

    // ── Users ──────────────────────────────────────────────────────────────────────────

    public record UserFilter(String q, String kind, String status) {
    }

    private static final String USER_ROW = """
            SELECT u.id, u.name, u.email, u.phone, u.avatar_url, u.platform_role, u.suspended_at, u.created_at,
                   (SELECT count(*) FROM orders o WHERE o.customer_id = u.id AND o.placed_at IS NOT NULL) orders,
                   (SELECT COALESCE(sum(o.total), 0) FROM orders o WHERE o.customer_id = u.id AND %s) spent,
                   (SELECT count(*) FROM business_member m WHERE m.user_id = u.id AND m.active) businesses
              FROM users u
            """.formatted(SOLD);

    /** {@code kind}: staff, merchant (member of a shop) or customer (neither). */
    public PageResponse<AdminUserRow> users(UserFilter f, int page, int size) {
        Where w = new Where();
        if (notBlank(f.q())) {
            w.and("(u.name ILIKE :q OR u.email ILIKE :q OR u.phone ILIKE :q)", "q", like(f.q()));
        }
        String merchant = "EXISTS (SELECT 1 FROM business_member m WHERE m.user_id = u.id AND m.active)";
        switch (f.kind() == null ? "" : f.kind()) {
            case "staff" -> w.and("u.platform_role IS NOT NULL");
            case "merchant" -> w.and(merchant);
            case "customer" -> w.and("u.platform_role IS NULL AND NOT " + merchant);
            default -> {
            }
        }
        if ("suspended".equals(f.status())) {
            w.and("u.suspended_at IS NOT NULL");
        } else if ("active".equals(f.status())) {
            w.and("u.suspended_at IS NULL");
        }
        long total = jdbc.queryForObject("SELECT count(*) FROM users u" + w.sql, w.p, Long.class);
        List<AdminUserRow> items = jdbc.query(USER_ROW + w.sql + " ORDER BY u.created_at DESC, u.id"
                + page(w, page, size), w.p, this::userRow);
        return new PageResponse<>(items, total, page, size);
    }

    public Optional<AdminUserRow> user(UUID id) {
        return jdbc.query(USER_ROW + " WHERE u.id = :id", new MapSqlParameterSource("id", id), this::userRow)
                .stream().findFirst();
    }

    /** [last seen (latest session start or rotation), active sessions, bookings, reviews]. */
    public Object[] userActivity(UUID id, Instant now) {
        MapSqlParameterSource p = new MapSqlParameterSource().addValue("id", id).addValue("now", ts(now));
        return jdbc.queryForObject("""
                SELECT (SELECT max(COALESCE(s.rotated_at, s.created_at)) FROM user_session s WHERE s.user_id = :id) seen,
                       (SELECT count(DISTINCT s.family_id) FROM user_session s WHERE s.user_id = :id
                            AND s.revoked_at IS NULL AND s.rotated_at IS NULL AND s.expires_at > :now) sessions,
                       (SELECT count(*) FROM appointment a WHERE a.customer_id = :id) bookings,
                       (SELECT count(*) FROM review r WHERE r.author_id = :id) reviews
                """, p, (rs, i) -> new Object[] {instant(rs, "seen"), rs.getLong("sessions"), rs.getLong("bookings"),
                        rs.getLong("reviews")});
    }

    public List<AdminUserDetail.Membership> memberships(UUID userId) {
        return jdbc.query("""
                SELECT b.id, b.name, b.type, m.role, b.verification, b.suspended_at
                  FROM business_member m JOIN business b ON b.id = m.business_id
                 WHERE m.user_id = :id AND m.active ORDER BY b.name
                """, new MapSqlParameterSource("id", userId), (rs, i) -> new AdminUserDetail.Membership(
                rs.getString("id"), rs.getString("name"), rs.getString("type"), rs.getString("role"),
                rs.getString("verification"), instant(rs, "suspended_at")));
    }

    private AdminUserRow userRow(ResultSet rs, int i) throws SQLException {
        String role = rs.getString("platform_role");
        return new AdminUserRow(rs.getString("id"), rs.getString("name"), rs.getString("email"),
                rs.getString("phone"), rs.getString("avatar_url"), role == null ? null : PlatformRole.valueOf(role),
                instant(rs, "suspended_at"), rs.getLong("orders"), rs.getBigDecimal("spent"),
                rs.getLong("businesses"), instant(rs, "created_at"));
    }

    // ── Orders ─────────────────────────────────────────────────────────────────────────

    public record OrderFilter(String q, String status, UUID businessId, UUID customerId) {
    }

    private static final String ORDER_ROW = """
            SELECT o.id, o.number, o.status, o.method, o.total, p.method pay_method, p.status pay_status,
                   o.business_id, b.name shop_name, o.customer_id, COALESCE(u.name, o.contact_name) customer_name,
                   o.cancel_reason, COALESCE(o.placed_at, o.created_at) at
              FROM orders o JOIN business b ON b.id = o.business_id LEFT JOIN users u ON u.id = o.customer_id
              LEFT JOIN payment p ON p.order_id = o.id AND p.channel <> 'POS'
            """;

    public PageResponse<AdminOrderRow> orders(OrderFilter f, int page, int size) {
        Where w = orderWhere(f);
        long total = jdbc.queryForObject("""
                SELECT count(*) FROM orders o JOIN business b ON b.id = o.business_id
                  LEFT JOIN users u ON u.id = o.customer_id""" + w.sql, w.p, Long.class);
        List<AdminOrderRow> items = jdbc.query(ORDER_ROW + w.sql + " ORDER BY at DESC, o.number DESC"
                + page(w, page, size), w.p, AdminQueries::orderRow);
        return new PageResponse<>(items, total, page, size);
    }

    public List<AdminOrderRow> recentOrders(OrderFilter f, int limit) {
        Where w = orderWhere(f);
        return jdbc.query(ORDER_ROW + w.sql + " ORDER BY at DESC, o.number DESC" + page(w, 0, limit), w.p,
                AdminQueries::orderRow);
    }

    private static Where orderWhere(OrderFilter f) {
        Where w = new Where();
        if (notBlank(f.q())) {
            w.and("(o.number ILIKE :q OR u.name ILIKE :q OR u.email ILIKE :q OR u.phone ILIKE :q OR b.name ILIKE :q"
                    + " OR o.contact_name ILIKE :q OR o.contact_phone ILIKE :q)",
                    "q", like(f.q()));
        }
        if ("open".equals(f.status())) {
            w.and("o.status IN ('NEW', 'ACCEPTED', 'PACKED', 'SHIPPED')");
        } else if ("unpaid".equals(f.status())) {
            w.and("o.placed_at IS NULL");
        } else if (notBlank(f.status())) {
            w.and("o.status = :status", "status", f.status().toUpperCase(java.util.Locale.ROOT));
        }
        if (f.businessId() != null) {
            w.and("o.business_id = :biz", "biz", f.businessId());
        }
        if (f.customerId() != null) {
            w.and("o.customer_id = :cust", "cust", f.customerId());
        }
        return w;
    }

    public Optional<UUID> orderId(String number) {
        return jdbc.query("SELECT id FROM orders WHERE upper(number) = upper(:n)",
                new MapSqlParameterSource("n", number == null ? "" : number.trim()),
                (rs, i) -> rs.getObject("id", UUID.class)).stream().findFirst();
    }

    public Optional<AdminOrderDetail> order(UUID id) {
        MapSqlParameterSource p = new MapSqlParameterSource("id", id);
        List<AdminOrderRow> rows = jdbc.query(ORDER_ROW + " WHERE o.id = :id", p, AdminQueries::orderRow);
        if (rows.isEmpty()) {
            return Optional.empty();
        }
        List<AdminOrderDetail.Line> lines = jdbc.query("""
                SELECT title, variant_name, qty, unit_price FROM order_line WHERE order_id = :id ORDER BY position
                """, p, (rs, i) -> new AdminOrderDetail.Line(rs.getString("title"), rs.getString("variant_name"),
                rs.getInt("qty"), rs.getBigDecimal("unit_price")));
        List<AdminOrderDetail.Event> events = jdbc.query("""
                SELECT e.status, e.note, u.name by_name, e.at FROM order_event e LEFT JOIN users u ON u.id = e.by_user_id
                 WHERE e.order_id = :id ORDER BY e.at, e.created_at
                """, p, (rs, i) -> new AdminOrderDetail.Event(rs.getString("status"), rs.getString("note"),
                rs.getString("by_name"), instant(rs, "at")));
        List<AdminOrderDetail.Payment> pays = jdbc.query("""
                SELECT method, channel, status, amount, commission, paid_at, refunded_at, payout_id
                  FROM payment WHERE order_id = :id AND channel <> 'POS'
                """, p, (rs, i) -> new AdminOrderDetail.Payment(rs.getString("method"), rs.getString("channel"),
                rs.getString("status"), rs.getBigDecimal("amount"), rs.getBigDecimal("commission"),
                instant(rs, "paid_at"), instant(rs, "refunded_at"), rs.getString("payout_id")));
        return jdbc.query("""
                SELECT u.email, COALESCE(u.phone, o.contact_phone) phone, b.phone shop_phone, o.address::text address,
                       o.note, o.subtotal, o.discount, o.promo_discount, o.promo_code, o.delivery_fee
                  FROM orders o LEFT JOIN users u ON u.id = o.customer_id JOIN business b ON b.id = o.business_id
                 WHERE o.id = :id
                """, p, (rs, i) -> new AdminOrderDetail(rows.get(0), rs.getString("email"), rs.getString("phone"),
                rs.getString("shop_phone"), map(rs.getString("address")), rs.getString("note"),
                rs.getBigDecimal("subtotal"), rs.getBigDecimal("discount"), rs.getBigDecimal("promo_discount"),
                rs.getString("promo_code"), rs.getBigDecimal("delivery_fee"), lines, events,
                pays.isEmpty() ? null : pays.get(0), List.of())).stream().findFirst();
    }

    private static AdminOrderRow orderRow(ResultSet rs, int i) throws SQLException {
        return new AdminOrderRow(rs.getString("id"), rs.getString("number"), rs.getString("status"),
                rs.getString("method"), rs.getBigDecimal("total"), rs.getString("pay_method"),
                rs.getString("pay_status"), rs.getString("business_id"), rs.getString("shop_name"),
                rs.getString("customer_id"), rs.getString("customer_name"), rs.getString("cancel_reason"),
                instant(rs, "at"));
    }

    // ── Reviews ────────────────────────────────────────────────────────────────────────

    public record ReviewFilter(String q, Integer stars, String status, UUID businessId, UUID id) {
    }

    public PageResponse<AdminReviewRow> reviews(ReviewFilter f, int page, int size) {
        Where w = new Where();
        if (notBlank(f.q())) {
            w.and("(r.text ILIKE :q OR r.author_name ILIKE :q OR b.name ILIKE :q)", "q", like(f.q()));
        }
        if (f.stars() != null) {
            w.and("r.stars = :stars", "stars", f.stars());
        }
        if ("hidden".equals(f.status())) {
            w.and("r.hidden_at IS NOT NULL");
        } else if ("visible".equals(f.status())) {
            w.and("r.hidden_at IS NULL");
        } else if ("low".equals(f.status())) {
            w.and("r.hidden_at IS NULL AND r.stars <= 2");
        }
        if (f.businessId() != null) {
            w.and("r.business_id = :biz", "biz", f.businessId());
        }
        if (f.id() != null) {
            w.and("r.id = :id", "id", f.id());
        }
        String from = " FROM review r JOIN business b ON b.id = r.business_id";
        long total = jdbc.queryForObject("SELECT count(*)" + from + w.sql, w.p, Long.class);
        List<AdminReviewRow> items = jdbc.query("""
                SELECT r.id, r.business_id, b.name shop_name, r.target_type,
                       COALESCE(pr.title, sv.name) item_name, r.author_id, r.author_name, r.stars, r.text,
                       r.tags::text tags, r.reply, r.verified, r.at, r.hidden_at, r.hidden_reason
                """ + from + """
                 LEFT JOIN product pr ON r.target_type = 'PRODUCT' AND pr.id = r.target_id
                 LEFT JOIN service sv ON r.target_type = 'SERVICE' AND sv.id = r.target_id
                """ + w.sql + " ORDER BY r.at DESC, r.id" + page(w, page, size), w.p,
                (rs, i) -> new AdminReviewRow(rs.getString("id"), rs.getString("business_id"),
                        rs.getString("shop_name"), rs.getString("target_type"), rs.getString("item_name"),
                        rs.getString("author_id"), rs.getString("author_name"), rs.getInt("stars"),
                        rs.getString("text"), strings(rs.getString("tags")), rs.getString("reply"),
                        rs.getBoolean("verified"), instant(rs, "at"), instant(rs, "hidden_at"),
                        rs.getString("hidden_reason")));
        return new PageResponse<>(items, total, page, size);
    }

    // ── Payouts ────────────────────────────────────────────────────────────────────────

    /**
     * Per shop: released payments not yet paid out, refunds of paid-out payments not yet taken
     * back, and paid payments still on hold. A payment is released once its order was fulfilled
     * before {@code releaseBefore} ({@code vbiz.payouts.release-after}).
     */
    private static final String BALANCES = """
            WITH pay AS (
                SELECT o.business_id, p.amount, p.commission, p.status, p.payout_id, p.clawback_payout_id,
                       (o.status IN ('DELIVERED', 'PICKED_UP') AND o.fulfilled_at IS NOT NULL
                            AND o.fulfilled_at <= :release) released
                  FROM payment p JOIN orders o ON o.id = p.order_id
                 WHERE p.channel = 'ONLINE'
            )
            SELECT b.id, b.name, b.type, b.bakong_id, b.verification, b.suspended_at,
                   count(*) FILTER (WHERE pay.status = 'PAID' AND pay.payout_id IS NULL AND pay.released) payments,
                   COALESCE(sum(pay.amount) FILTER (WHERE pay.status = 'PAID' AND pay.payout_id IS NULL AND pay.released), 0) released,
                   COALESCE(sum(pay.commission) FILTER (WHERE pay.status = 'PAID' AND pay.payout_id IS NULL AND pay.released), 0) commission,
                   COALESCE(sum(pay.amount) FILTER (WHERE pay.status = 'REFUNDED' AND pay.payout_id IS NOT NULL
                       AND pay.clawback_payout_id IS NULL), 0) back,
                   COALESCE(sum(pay.commission) FILTER (WHERE pay.status = 'REFUNDED' AND pay.payout_id IS NOT NULL
                       AND pay.clawback_payout_id IS NULL), 0) back_commission,
                   COALESCE(sum(pay.amount) FILTER (WHERE pay.status = 'PAID' AND pay.payout_id IS NULL
                       AND NOT pay.released), 0) on_hold,
                   (SELECT max(x.paid_at) FROM payout x WHERE x.business_id = b.id) last_payout
              FROM business b JOIN pay ON pay.business_id = b.id
            """;

    public List<PayoutBalance> balances(Instant releaseBefore) {
        return jdbc.query(BALANCES + " GROUP BY b.id ORDER BY b.name", new MapSqlParameterSource("release",
                ts(releaseBefore)), AdminQueries::balance).stream()
                .filter(b -> b.payable().signum() != 0 || b.onHold().signum() > 0).toList();
    }

    public Optional<PayoutBalance> balance(UUID businessId, Instant releaseBefore) {
        return jdbc.query(BALANCES + " WHERE b.id = :id GROUP BY b.id", new MapSqlParameterSource("release",
                ts(releaseBefore)).addValue("id", businessId), AdminQueries::balance).stream().findFirst();
    }

    private static PayoutBalance balance(ResultSet rs, int i) throws SQLException {
        BigDecimal released = rs.getBigDecimal("released");
        BigDecimal commission = rs.getBigDecimal("commission");
        BigDecimal back = rs.getBigDecimal("back");
        BigDecimal payable = released.subtract(commission).subtract(back.subtract(rs.getBigDecimal("back_commission")));
        return new PayoutBalance(rs.getString("id"), rs.getString("name"), rs.getString("type"),
                rs.getString("bakong_id"), rs.getString("verification"), rs.getTimestamp("suspended_at") != null,
                rs.getLong("payments"), released, commission, back, payable, rs.getBigDecimal("on_hold"),
                instant(rs, "last_payout"));
    }

    /** A payment the next payout settles: {@code back} = a refund taken back. */
    public record Settled(UUID id, BigDecimal amount, BigDecimal commission, boolean back) {
    }

    /** Locks and returns the payments a payout for the shop would settle now. */
    public List<Settled> lockSettlement(UUID businessId, Instant releaseBefore) {
        MapSqlParameterSource p = new MapSqlParameterSource().addValue("id", businessId)
                .addValue("release", ts(releaseBefore));
        return jdbc.query("""
                SELECT p.id, p.amount, p.commission, (p.status = 'REFUNDED') back
                  FROM payment p JOIN orders o ON o.id = p.order_id
                 WHERE o.business_id = :id AND p.channel = 'ONLINE'
                   AND ((p.status = 'PAID' AND p.payout_id IS NULL AND o.status IN ('DELIVERED', 'PICKED_UP')
                          AND o.fulfilled_at IS NOT NULL AND o.fulfilled_at <= :release)
                     OR (p.status = 'REFUNDED' AND p.payout_id IS NOT NULL AND p.clawback_payout_id IS NULL))
                 ORDER BY p.paid_at
                 FOR UPDATE OF p
                """, p, (rs, i) -> new Settled(rs.getObject("id", UUID.class), rs.getBigDecimal("amount"),
                rs.getBigDecimal("commission"), rs.getBoolean("back")));
    }

    public void settle(UUID payoutId, Collection<UUID> paid, Collection<UUID> takenBack) {
        if (!paid.isEmpty()) {
            jdbc.update("UPDATE payment SET payout_id = :payout, updated_at = now() WHERE id IN (:ids)",
                    new MapSqlParameterSource("payout", payoutId).addValue("ids", paid));
        }
        if (!takenBack.isEmpty()) {
            jdbc.update("UPDATE payment SET clawback_payout_id = :payout, updated_at = now() WHERE id IN (:ids)",
                    new MapSqlParameterSource("payout", payoutId).addValue("ids", takenBack));
        }
    }

    public PageResponse<PayoutResponse> payouts(UUID businessId, int page, int size) {
        Where w = new Where();
        if (businessId != null) {
            w.and("x.business_id = :biz", "biz", businessId);
        }
        long total = jdbc.queryForObject("SELECT count(*) FROM payout x" + w.sql, w.p, Long.class);
        List<PayoutResponse> items = jdbc.query("""
                SELECT x.*, b.name shop_name, u.name paid_by_name
                  FROM payout x JOIN business b ON b.id = x.business_id LEFT JOIN users u ON u.id = x.paid_by
                """ + w.sql + " ORDER BY x.paid_at DESC, x.id" + page(w, page, size), w.p,
                (rs, i) -> new PayoutResponse(rs.getString("id"), rs.getString("business_id"),
                        rs.getString("shop_name"), rs.getBigDecimal("gross"), rs.getBigDecimal("commission"),
                        rs.getBigDecimal("amount"), rs.getInt("payments_count"), rs.getString("bakong_id"),
                        rs.getString("reference"), rs.getString("note"), instant(rs, "paid_at"),
                        rs.getString("paid_by_name")));
        return new PageResponse<>(items, total, page, size);
    }

    // ── Audit ──────────────────────────────────────────────────────────────────────────

    public record AuditFilter(String q, String targetType, String targetId, String action) {
    }

    public PageResponse<AuditEntry> audit(AuditFilter f, int page, int size) {
        Where w = new Where();
        if (notBlank(f.q())) {
            w.and("(a.actor_name ILIKE :q OR a.target_label ILIKE :q OR a.reason ILIKE :q OR a.target_id ILIKE :q)",
                    "q", like(f.q()));
        }
        if (notBlank(f.targetType())) {
            w.and("a.target_type = :tt", "tt", f.targetType());
        }
        if (notBlank(f.targetId())) {
            w.and("a.target_id = :tid", "tid", f.targetId());
        }
        if (notBlank(f.action())) {
            w.and("a.action = :action", "action", f.action());
        }
        long total = jdbc.queryForObject("SELECT count(*) FROM admin_audit a" + w.sql, w.p, Long.class);
        List<AuditEntry> items = jdbc.query("SELECT a.*, a.details::text details_json FROM admin_audit a" + w.sql
                + " ORDER BY a.at DESC, a.id" + page(w, page, size), w.p,
                (rs, i) -> new AuditEntry(rs.getString("id"), rs.getString("actor_id"), rs.getString("actor_name"),
                        rs.getString("action"), rs.getString("target_type"), rs.getString("target_id"),
                        rs.getString("target_label"), rs.getString("reason"), map(rs.getString("details_json")),
                        instant(rs, "at")));
        return new PageResponse<>(items, total, page, size);
    }

    // ── helpers ────────────────────────────────────────────────────────────────────────

    /** A WHERE clause built from optional filters. */
    private static final class Where {
        private final StringBuilder sql = new StringBuilder(" WHERE TRUE");
        private final MapSqlParameterSource p = new MapSqlParameterSource();

        Where and(String condition) {
            sql.append(" AND ").append(condition);
            return this;
        }

        Where and(String condition, String name, Object value) {
            p.addValue(name, value);
            return and(condition);
        }
    }

    private static String page(Where w, int page, int size) {
        w.p.addValue("limit", size).addValue("offset", (long) page * size);
        return " LIMIT :limit OFFSET :offset";
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static String like(String q) {
        return "%" + q.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    private static Timestamp ts(Instant i) {
        return Timestamp.from(i);
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        OffsetDateTime t = rs.getObject(column, OffsetDateTime.class);
        return t == null ? null : t.toInstant();
    }

    private Map<String, Object> map(String raw) {
        if (raw == null) {
            return null;
        }
        try {
            return json.readValue(raw, new TypeReference<Map<String, Object>>() { });
        } catch (Exception e) {
            return Map.of();
        }
    }

    private List<String> strings(String raw) {
        if (raw == null) {
            return List.of();
        }
        try {
            return new ArrayList<>(json.readValue(raw, new TypeReference<List<String>>() { }));
        } catch (Exception e) {
            return List.of();
        }
    }
}
