package com.kosign.vbiz.marketplace.repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import lombok.RequiredArgsConstructor;

/**
 * SQL side of marketplace search over the {@code marketplace_listing} view: text (trigram-indexed
 * ILIKE), type, category, price, rating and sale filters. Returns matching listing ids only.
 */
@Repository
@RequiredArgsConstructor
public class ListingSearchRepository {

    private final NamedParameterJdbcTemplate jdbc;

    /** A listing that matched: its kind (PRODUCT / SERVICE) and id. */
    public record Hit(String kind, UUID id) {
    }

    /** Filters; null / empty = not applied. */
    public record Filter(String q, String kind, List<String> categories, BigDecimal min, BigDecimal max,
            Double rating, boolean sale) {
    }

    public List<Hit> find(Filter f) {
        StringBuilder sql = new StringBuilder("""
                SELECT l.kind, l.id FROM marketplace_listing l
                JOIN business b ON b.id = l.business_id
                JOIN category c ON c.id = b.category_id
                WHERE b.online AND b.suspended_at IS NULL AND b.verification <> 'REJECTED'""");
        MapSqlParameterSource p = new MapSqlParameterSource();
        if (f.q() != null && !f.q().isBlank()) {
            sql.append("""
                     AND (l.name ILIKE :q ESCAPE '\\' OR l.description ILIKE :q ESCAPE '\\'
                          OR b.name ILIKE :q ESCAPE '\\' OR c.name ILIKE :q ESCAPE '\\'
                          OR b.category_id ILIKE :q ESCAPE '\\')""");
            p.addValue("q", "%" + escapeLike(f.q().trim()) + "%");
        }
        if (f.kind() != null) {
            sql.append(" AND l.kind = :kind");
            p.addValue("kind", f.kind());
        }
        if (f.categories() != null && !f.categories().isEmpty()) {
            sql.append(" AND b.category_id IN (:cats)");
            p.addValue("cats", f.categories());
        }
        if (f.min() != null) {
            sql.append(" AND l.net_price >= :min");
            p.addValue("min", f.min());
        }
        if (f.max() != null) {
            sql.append(" AND l.net_price <= :max");
            p.addValue("max", f.max());
        }
        if (f.rating() != null && f.rating() > 0) {
            sql.append(" AND l.rating >= :rating");
            p.addValue("rating", BigDecimal.valueOf(f.rating()));
        }
        if (f.sale()) {
            sql.append(" AND l.on_sale");
        }
        return jdbc.query(sql.toString(), p, (rs, i) -> new Hit(rs.getString(1), rs.getObject(2, UUID.class)));
    }

    static String escapeLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
