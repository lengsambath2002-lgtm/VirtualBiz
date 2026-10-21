package com.kosign.vbiz.inventory.repository;

import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

import com.kosign.vbiz.catalog.domain.Product;
import com.kosign.vbiz.catalog.domain.ProductVariant;
import com.kosign.vbiz.common.list.DayRange;
import com.kosign.vbiz.common.list.PageQuery;
import com.kosign.vbiz.inventory.domain.StockMovement;
import com.kosign.vbiz.inventory.domain.StockReason;

import jakarta.persistence.criteria.Subquery;

/** Filters of the stock movement history (docs/api/phase17-more-lists.md). */
public final class MovementSpecs {

    public static final Map<String, String> SORTS = Map.of("at", "at", "delta", "delta");

    private MovementSpecs() {
    }

    /**
     * @param direction "in" (stock added) or "out" (stock taken)
     * @param q         product title, SKU or barcode
     */
    public static Specification<StockMovement> history(UUID businessId, StockReason reason, String direction,
            UUID productId, UUID variantId, String q, DayRange range) {
        return Specification.allOf(
                (r, cq, cb) -> cb.equal(r.get("businessId"), businessId),
                reason == null ? null : (r, cq, cb) -> cb.equal(r.get("reason"), reason),
                "in".equals(direction) ? (r, cq, cb) -> cb.greaterThan(r.get("delta"), 0)
                        : "out".equals(direction) ? (r, cq, cb) -> cb.lessThan(r.get("delta"), 0) : null,
                variantId == null ? null : (r, cq, cb) -> cb.equal(r.get("variantId"), variantId),
                productId == null ? null : (r, cq, cb) -> {
                    Subquery<UUID> sq = cq.subquery(UUID.class);
                    var v = sq.from(ProductVariant.class);
                    sq.select(v.get("id")).where(cb.equal(v.get("id"), r.get("variantId")),
                            cb.equal(v.get("productId"), productId));
                    return cb.exists(sq);
                },
                q == null || q.isBlank() ? null : (r, cq, cb) -> {
                    String like = "%" + q.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%")
                            .replace("_", "\\_") + "%";
                    Subquery<UUID> titles = cq.subquery(UUID.class);
                    var p = titles.from(Product.class);
                    titles.select(p.get("id")).where(cb.like(cb.lower(p.get("title")), like, '\\'));
                    Subquery<UUID> sq = cq.subquery(UUID.class);
                    var v = sq.from(ProductVariant.class);
                    sq.select(v.get("id")).where(cb.equal(v.get("id"), r.get("variantId")),
                            cb.or(cb.like(cb.lower(v.get("sku")), like, '\\'), cb.like(v.get("barcode"), like, '\\'),
                                    v.get("productId").in(titles)));
                    return cb.exists(sq);
                },
                range == null || range.start() == null ? null
                        : (r, cq, cb) -> cb.greaterThanOrEqualTo(r.get("at"), range.start()),
                range == null || range.end() == null ? null : (r, cq, cb) -> cb.lessThan(r.get("at"), range.end()));
    }

    public static Sort sort(PageQuery pq) {
        Sort s = Sort.by(SORTS.get(pq.sortKey())).and(Sort.by("createdAt")).and(Sort.by("id"));
        return pq.desc() ? s.descending() : s.ascending();
    }
}
