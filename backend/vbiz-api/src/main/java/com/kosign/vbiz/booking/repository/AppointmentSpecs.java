package com.kosign.vbiz.booking.repository;

import java.time.LocalDate;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

import com.kosign.vbiz.booking.domain.Appointment;
import com.kosign.vbiz.booking.domain.AppointmentSource;
import com.kosign.vbiz.booking.domain.AppointmentStatus;
import com.kosign.vbiz.common.list.PageQuery;
import com.kosign.vbiz.customer.domain.Client;

import jakarta.persistence.criteria.Subquery;

/** Filters of a provider's appointment list (docs/api/phase16-shop-lists.md). */
public final class AppointmentSpecs {

    public static final Map<String, String> SORTS = Map.of("when", "date", "price", "price", "number", "number");

    private AppointmentSpecs() {
    }

    public static Specification<Appointment> list(UUID businessId, AppointmentStatus status, UUID staffId,
            UUID serviceId, AppointmentSource source, LocalDate from, LocalDate to, String q) {
        return Specification.allOf(
                (r, cq, cb) -> cb.equal(r.get("businessId"), businessId),
                status == null ? null : (r, cq, cb) -> cb.equal(r.get("status"), status),
                staffId == null ? null : (r, cq, cb) -> cb.equal(r.get("staffId"), staffId),
                serviceId == null ? null : (r, cq, cb) -> cb.equal(r.get("serviceId"), serviceId),
                source == null ? null : (r, cq, cb) -> cb.equal(r.get("source"), source),
                from == null ? null : (r, cq, cb) -> cb.greaterThanOrEqualTo(r.get("date"), from),
                to == null ? null : (r, cq, cb) -> cb.lessThanOrEqualTo(r.get("date"), to),
                q == null || q.isBlank() ? null : (r, cq, cb) -> {
                    String like = "%" + q.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%")
                            .replace("_", "\\_") + "%";
                    String digits = q.replaceAll("\\D", "");
                    Subquery<UUID> sq = cq.subquery(UUID.class);
                    var c = sq.from(Client.class);
                    sq.select(c.get("id")).where(cb.equal(c.get("id"), r.get("clientId")),
                            digits.length() >= 3
                                    ? cb.or(cb.like(cb.lower(c.get("name")), like, '\\'),
                                            cb.like(c.get("phone"), "%" + digits.replaceFirst("^0", "") + "%"))
                                    : cb.like(cb.lower(c.get("name")), like, '\\'));
                    return cb.or(cb.like(cb.lower(r.get("number")), like, '\\'), cb.exists(sq));
                });
    }

    /** By day then start time for "when"; the number breaks ties. */
    public static Sort sort(PageQuery pq) {
        Sort s = "when".equals(pq.sortKey()) ? Sort.by("date").and(Sort.by("start"))
                : Sort.by(SORTS.get(pq.sortKey()));
        s = s.and(Sort.by("number"));
        return pq.desc() ? s.descending() : s.ascending();
    }
}
