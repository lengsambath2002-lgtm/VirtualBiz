package com.kosign.vbiz.pos.repository;

import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

import com.kosign.vbiz.common.list.DayRange;
import com.kosign.vbiz.common.list.PageQuery;
import com.kosign.vbiz.payment.domain.PaymentMethod;
import com.kosign.vbiz.pos.domain.Sale;
import com.kosign.vbiz.pos.domain.SalePayment;
import com.kosign.vbiz.pos.domain.SaleRefund;

import jakarta.persistence.criteria.Subquery;

/** Filters of a shop's sale history (docs/api/phase16-shop-lists.md). */
public final class SaleSpecs {

    public static final Map<String, String> SORTS = Map.of("at", "at", "total", "total", "number", "number");

    private SaleSpecs() {
    }

    /**
     * @param receiptsOnly the register's R- receipts only (product shops)
     * @param refunded     "yes" / "no" for sales with or without a refund
     */
    public static Specification<Sale> history(UUID businessId, boolean receiptsOnly, String q, PaymentMethod pay,
            String cashier, String refunded, DayRange range) {
        return Specification.allOf(
                (r, cq, cb) -> cb.equal(r.get("businessId"), businessId),
                receiptsOnly ? (r, cq, cb) -> cb.like(r.get("number"), "R-%") : null,
                range == null || range.start() == null ? null
                        : (r, cq, cb) -> cb.greaterThanOrEqualTo(r.get("at"), range.start()),
                range == null || range.end() == null ? null : (r, cq, cb) -> cb.lessThan(r.get("at"), range.end()),
                q == null || q.isBlank() ? null : (r, cq, cb) -> {
                    String like = "%" + q.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%")
                            .replace("_", "\\_") + "%";
                    return cb.or(cb.like(cb.lower(r.get("number")), like, '\\'),
                            cb.like(cb.lower(cb.coalesce(r.get("customerName"), "")), like, '\\'));
                },
                pay == null ? null : (r, cq, cb) -> {
                    Subquery<UUID> sq = cq.subquery(UUID.class);
                    var p = sq.from(SalePayment.class);
                    sq.select(p.get("saleId")).where(cb.equal(p.get("saleId"), r.get("id")), cb.equal(p.get("method"), pay));
                    return cb.exists(sq);
                },
                cashier == null || cashier.isBlank() ? null : (r, cq, cb) -> cb.equal(r.get("byName"), cashier),
                refunded == null || refunded.isBlank() ? null : (r, cq, cb) -> {
                    Subquery<UUID> sq = cq.subquery(UUID.class);
                    var x = sq.from(SaleRefund.class);
                    sq.select(x.get("saleId")).where(cb.equal(x.get("saleId"), r.get("id")));
                    return "yes".equals(refunded) ? cb.exists(sq) : cb.not(cb.exists(sq));
                });
    }

    public static Sort sort(PageQuery pq) {
        Sort s = Sort.by(SORTS.get(pq.sortKey())).and(Sort.by("number"));
        return pq.desc() ? s.descending() : s.ascending();
    }
}
