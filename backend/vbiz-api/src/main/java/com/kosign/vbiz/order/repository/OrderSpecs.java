package com.kosign.vbiz.order.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.Locale;
import java.util.UUID;

import org.springframework.data.jpa.domain.Specification;

import com.kosign.vbiz.order.domain.FulfilmentMethod;
import com.kosign.vbiz.order.domain.Order;
import com.kosign.vbiz.order.domain.OrderLine;
import com.kosign.vbiz.order.domain.OrderSource;
import com.kosign.vbiz.order.domain.OrderStatus;
import com.kosign.vbiz.payment.domain.Payment;
import com.kosign.vbiz.payment.domain.PaymentChannel;
import com.kosign.vbiz.payment.domain.PaymentMethod;

import jakarta.persistence.criteria.Subquery;

/** Filters of a shop's order list (docs/api/phase16-shop-lists.md); each is left out when null. */
public final class OrderSpecs {

    private OrderSpecs() {
    }

    public static Specification<Order> placedBy(UUID businessId) {
        return (r, q, cb) -> cb.and(cb.equal(r.get("businessId"), businessId), cb.isNotNull(r.get("placedAt")));
    }

    public static Specification<Order> status(Collection<OrderStatus> statuses) {
        return statuses == null ? null : (r, q, cb) -> r.get("status").in(statuses);
    }

    public static Specification<Order> placedFrom(Instant from) {
        return from == null ? null : (r, q, cb) -> cb.greaterThanOrEqualTo(r.get("placedAt"), from);
    }

    public static Specification<Order> placedBefore(Instant to) {
        return to == null ? null : (r, q, cb) -> cb.lessThan(r.get("placedAt"), to);
    }

    public static Specification<Order> method(FulfilmentMethod m) {
        return m == null ? null : (r, q, cb) -> cb.equal(r.get("method"), m);
    }

    public static Specification<Order> source(OrderSource s) {
        return s == null ? null : (r, q, cb) -> cb.equal(r.get("source"), s);
    }

    /** Paid (or to be paid) online with this method. */
    public static Specification<Order> paidWith(PaymentMethod m) {
        return m == null ? null : (r, q, cb) -> {
            Subquery<UUID> sq = q.subquery(UUID.class);
            var p = sq.from(Payment.class);
            sq.select(p.get("orderId")).where(cb.equal(p.get("orderId"), r.get("id")),
                    cb.equal(p.get("method"), m), cb.notEqual(p.get("channel"), PaymentChannel.POS));
            return cb.exists(sq);
        };
    }

    /** Order number, the customer's name or phone, or an item's title. */
    public static Specification<Order> text(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String like = "%" + raw.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%")
                .replace("_", "\\_") + "%";
        String digits = raw.replaceAll("\\D", "");
        return (r, q, cb) -> {
            Subquery<UUID> lines = q.subquery(UUID.class);
            var l = lines.from(OrderLine.class);
            lines.select(l.get("orderId")).where(cb.equal(l.get("orderId"), r.get("id")),
                    cb.like(cb.lower(l.get("title")), like, '\\'));
            var any = cb.or(cb.like(cb.lower(r.get("number")), like, '\\'),
                    cb.like(cb.lower(r.get("contactName")), like, '\\'), cb.exists(lines));
            return digits.length() >= 3
                    ? cb.or(any, cb.like(r.get("contactPhone"), "%" + digits.replaceFirst("^0", "") + "%"))
                    : any;
        };
    }
}
