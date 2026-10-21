package com.kosign.vbiz.customer.repository;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import com.kosign.vbiz.common.list.DayRange;
import com.kosign.vbiz.common.list.PageQuery;
import com.kosign.vbiz.common.list.PageResponse;
import com.kosign.vbiz.customer.payload.ClientRow;

import lombok.RequiredArgsConstructor;

/** A shop's customers with lifetime numbers, filtered, sorted and paged in SQL. */
@Repository
@RequiredArgsConstructor
public class ClientQueries {

    public static final Map<String, String> SORTS = Map.of("name", "lower(name)", "spent", "spent", "last",
            "last_at", "since", "since", "orders", "orders", "visits", "visits");

    private final NamedParameterJdbcTemplate jdbc;

    public record Filter(String q, String district, String segment, String account, DayRange since) {
    }

    private static final String STATS = """
            WITH s AS (
              SELECT c.id, c.name, c.phone, c.email, c.district, c.note, c.since, c.user_id,
                     COALESCE(o.n, 0) orders, COALESCE(a.visits, 0) visits, COALESCE(a.no_shows, 0) no_shows,
                     COALESCE(o.spent, 0) + COALESCE(x.spent, 0) spent,
                     GREATEST(o.last_at, x.last_at, (a.last_visit + time '12:00') AT TIME ZONE 'Asia/Phnom_Penh') last_at,
                     a.next_visit, a.last_visit
                FROM client c
                LEFT JOIN LATERAL (
                  SELECT count(*) n,
                         sum(o.total) FILTER (WHERE o.status IN ('DELIVERED', 'PICKED_UP')) spent,
                         max(o.placed_at) last_at
                    FROM orders o
                   WHERE o.business_id = c.business_id AND o.placed_at IS NOT NULL
                     AND (o.customer_id = c.user_id OR o.contact_phone = c.phone)) o ON TRUE
                LEFT JOIN LATERAL (
                  SELECT sum(sa.total) spent, max(sa.at) last_at FROM sale sa WHERE sa.client_id = c.id) x ON TRUE
                LEFT JOIN LATERAL (
                  SELECT count(*) FILTER (WHERE ap.status = 'COMPLETED') visits,
                         count(*) FILTER (WHERE ap.status = 'NO_SHOW') no_shows,
                         max(ap.date) FILTER (WHERE ap.status = 'COMPLETED') last_visit,
                         min(ap.date) FILTER (WHERE ap.status IN ('REQUESTED', 'BOOKED', 'CONFIRMED')
                                               AND ap.date >= :today) next_visit
                    FROM appointment ap WHERE ap.client_id = c.id) a ON TRUE
               WHERE c.business_id = :biz
            ), t AS (
              SELECT s.*, CASE
                  WHEN spent > 0 AND spent >= :vipMin THEN 'vip'
                  WHEN since > :newSince THEN 'new'
                  WHEN last_visit < :riskBefore AND next_visit IS NULL THEN 'risk'
                  END segment
                FROM s
            )
            """;

    public PageResponse<ClientRow> page(UUID businessId, Filter f, PageQuery pq, LocalDate today, Instant now) {
        MapSqlParameterSource p = new MapSqlParameterSource("biz", businessId)
                .addValue("today", Date.valueOf(today))
                .addValue("newSince", Timestamp.from(now.minusSeconds(30L * 86_400)))
                .addValue("riskBefore", Date.valueOf(today.minusDays(21)))
                .addValue("vipMin", vipMin(businessId, today));
        StringBuilder where = new StringBuilder(" WHERE TRUE");
        if (f.q() != null && !f.q().isBlank()) {
            String digits = f.q().replaceAll("\\D", "");
            where.append(" AND (name ILIKE :q OR email ILIKE :q").append(digits.length() >= 3 ? " OR phone LIKE :digits" : "")
                    .append(")");
            p.addValue("q", "%" + f.q().trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%")
                    .addValue("digits", "%" + digits.replaceFirst("^0", "") + "%");
        }
        if (f.district() != null && !f.district().isBlank()) {
            where.append(" AND district = :district");
            p.addValue("district", f.district());
        }
        if ("noshow".equals(f.segment())) {
            where.append(" AND no_shows > 0");
        } else if (f.segment() != null && !f.segment().isBlank()) {
            where.append(" AND segment = :segment");
            p.addValue("segment", f.segment());
        }
        if ("yes".equals(f.account())) {
            where.append(" AND user_id IS NOT NULL");
        } else if ("no".equals(f.account())) {
            where.append(" AND user_id IS NULL");
        }
        if (f.since() != null && f.since().start() != null) {
            where.append(" AND since >= :sinceFrom");
            p.addValue("sinceFrom", Timestamp.from(f.since().start()));
        }
        if (f.since() != null && f.since().end() != null) {
            where.append(" AND since < :sinceTo");
            p.addValue("sinceTo", Timestamp.from(f.since().end()));
        }
        long total = jdbc.queryForObject(STATS + "SELECT count(*) FROM t" + where, p, Long.class);
        p.addValue("limit", pq.size()).addValue("offset", pq.offset());
        List<ClientRow> items = jdbc.query(STATS + "SELECT * FROM t" + where + " ORDER BY " + pq.orderBy()
                + " LIMIT :limit OFFSET :offset", p, (rs, i) -> new ClientRow(rs.getString("id"),
                        rs.getString("name"), rs.getString("phone"), rs.getString("email"), rs.getString("district"),
                        rs.getString("note"), instant(rs.getObject("since", OffsetDateTime.class)),
                        rs.getString("user_id"), rs.getLong("orders"), rs.getLong("visits"), rs.getLong("no_shows"),
                        rs.getBigDecimal("spent"), instant(rs.getObject("last_at", OffsetDateTime.class)),
                        rs.getObject("next_visit", LocalDate.class), rs.getString("segment")));
        return new PageResponse<>(items, total, pq.page(), pq.size());
    }

    /** The spend a customer needs to be in the shop's top 20% (the prototype's VIP rule). */
    private BigDecimal vipMin(UUID businessId, LocalDate today) {
        MapSqlParameterSource p = new MapSqlParameterSource("biz", businessId).addValue("today", Date.valueOf(today))
                .addValue("newSince", new Timestamp(0)).addValue("riskBefore", Date.valueOf(today))
                .addValue("vipMin", BigDecimal.valueOf(Long.MAX_VALUE));
        List<BigDecimal> spends = jdbc.queryForList(STATS + "SELECT spent FROM s ORDER BY spent DESC", p,
                BigDecimal.class);
        if (spends.isEmpty()) {
            return BigDecimal.ONE;
        }
        BigDecimal min = spends.get(Math.max(0, (int) Math.floor(spends.size() * 0.2) - 1));
        return min.signum() > 0 ? min : BigDecimal.ONE;
    }

    private static Instant instant(OffsetDateTime t) {
        return t == null ? null : t.toInstant();
    }
}
