package com.kosign.vbiz.activity.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.activity.domain.ShopActivity;
import com.kosign.vbiz.activity.payload.ShopActivityResponse;
import com.kosign.vbiz.activity.repository.ShopActivityRepository;
import com.kosign.vbiz.business.service.WorkspaceAccess;
import com.kosign.vbiz.business.service.WorkspaceAccess.Workspace;
import com.kosign.vbiz.common.csv.CsvWriter;
import com.kosign.vbiz.common.list.DayRange;
import com.kosign.vbiz.common.list.PageQuery;
import com.kosign.vbiz.common.list.PageResponse;

import lombok.RequiredArgsConstructor;

/**
 * The shop activity log (docs/api/phase18-shop-activity.md): who did what in a shop. Services
 * record inside their own transaction, so an action that fails leaves no row. Owners and managers
 * read it; staff can't (it names everyone's actions).
 */
@Service
@RequiredArgsConstructor
public class ShopActivityLog {

    // Actions (target type in brackets).
    public static final String TEAM_INVITED = "TEAM_INVITED"; // MEMBER
    public static final String TEAM_INVITE_WITHDRAWN = "TEAM_INVITE_WITHDRAWN";
    public static final String TEAM_ROLE_CHANGED = "TEAM_ROLE_CHANGED";
    public static final String TEAM_REMOVED = "TEAM_REMOVED";
    public static final String TEAM_RESTORED = "TEAM_RESTORED";
    public static final String TEAM_ADDED = "TEAM_ADDED";
    public static final String SETTINGS_CHANGED = "SETTINGS_CHANGED"; // SHOP
    public static final String CATEGORY_REQUESTED = "CATEGORY_REQUESTED";
    public static final String CATEGORY_DECIDED = "CATEGORY_DECIDED";
    public static final String PRODUCT_CREATED = "PRODUCT_CREATED"; // PRODUCT
    public static final String PRODUCT_UPDATED = "PRODUCT_UPDATED";
    public static final String PRODUCT_STATUS = "PRODUCT_STATUS";
    public static final String PRODUCT_DELETED = "PRODUCT_DELETED";
    public static final String SERVICE_CREATED = "SERVICE_CREATED"; // SERVICE
    public static final String SERVICE_UPDATED = "SERVICE_UPDATED";
    public static final String SERVICE_DELETED = "SERVICE_DELETED";
    public static final String SERVICES_ONLINE = "SERVICES_ONLINE";
    public static final String ORDER_REJECTED = "ORDER_REJECTED"; // ORDER
    public static final String ORDER_RETURNED = "ORDER_RETURNED";
    public static final String SALE_REFUNDED = "SALE_REFUNDED"; // SALE
    public static final String CUSTOMER_ADDED = "CUSTOMER_ADDED"; // CUSTOMER
    public static final String CUSTOMER_EDITED = "CUSTOMER_EDITED";
    public static final String PROMOTION_CREATED = "PROMOTION_CREATED"; // PROMOTION
    public static final String PROMOTION_UPDATED = "PROMOTION_UPDATED";
    public static final String PROMOTION_ENDED = "PROMOTION_ENDED";
    public static final String DATA_IMPORTED = "DATA_IMPORTED"; // DATA
    public static final String DATA_EXPORTED = "DATA_EXPORTED";

    public static final int MAX_EXPORT = 50_000;

    private final ShopActivityRepository rows;
    private final WorkspaceAccess access;
    private final Clock clock;

    /** Joins the caller's transaction: the row exists only if the action does. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void record(Workspace w, String action, String targetType, Object targetId, String label,
            Map<String, ?> details) {
        record(w.businessId(), w.userId(), w.actorName(), action, targetType, targetId, label, details);
    }

    /** For services that hold ids instead of a {@link Workspace}. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void record(UUID businessId, UUID actorId, String actorName, String action, String targetType,
            Object targetId, String label, Map<String, ?> details) {
        ShopActivity a = new ShopActivity();
        a.setBusinessId(businessId);
        a.setActorId(actorId);
        a.setActorName(cut(actorName == null ? "—" : actorName, 80));
        a.setAction(action);
        a.setTargetType(targetType);
        a.setTargetId(targetId == null ? null : cut(String.valueOf(targetId), 64));
        a.setTargetLabel(cut(label, 200));
        Map<String, Object> d = new LinkedHashMap<>();
        if (details != null) {
            details.forEach((k, v) -> {
                if (v != null) {
                    d.put(k, v instanceof Number || v instanceof Boolean ? v : String.valueOf(v));
                }
            });
        }
        a.setDetails(d);
        a.setAt(clock.instant());
        rows.save(a);
    }

    public record Filter(String q, String action, String targetType, String targetId, UUID actorId,
            LocalDate from, LocalDate to) {
    }

    /** The shop's own log, for its owner and managers only (the platform doesn't read it). */
    @Transactional(readOnly = true)
    public PageResponse<ShopActivityResponse> page(Filter f, Integer page, Integer size) {
        UUID businessId = access.manager().businessId();
        PageQuery pq = PageQuery.of(page, size, null, Map.of("at", "at"), "-at", null);
        var result = rows.findAll(spec(businessId, f), PageRequest.of(pq.page(), pq.size(), order()));
        return new PageResponse<>(result.getContent().stream().map(ShopActivityLog::toResponse).toList(),
                result.getTotalElements(), pq.page(), pq.size());
    }

    /** The log as CSV, every matching row (up to 50,000); taking it is itself logged. */
    @Transactional
    public CsvWriter export(Filter f) {
        Workspace w = access.manager();
        List<ShopActivity> all = rows.findAll(spec(w.businessId(), f), PageRequest.of(0, MAX_EXPORT, order()))
                .getContent();
        CsvWriter csv = new CsvWriter("Time", "Who", "Action", "About", "Target", "Details");
        for (ShopActivity a : all) {
            csv.row(a.getAt(), a.getActorName(), a.getAction(), a.getTargetType(), a.getTargetLabel(),
                    a.getDetails().entrySet().stream().map(e -> e.getKey() + "=" + e.getValue())
                            .collect(Collectors.joining("; ")));
        }
        record(w, DATA_EXPORTED, "DATA", "activity", "Activity log", Map.of("rows", csv.rows()));
        return csv;
    }

    private static Sort order() {
        return Sort.by("at").descending().and(Sort.by("id").descending());
    }

    private static Specification<ShopActivity> spec(UUID businessId, Filter f) {
        DayRange range = DayRange.of(f.from(), f.to(), 3660);
        return Specification.allOf(
                (r, q, cb) -> cb.equal(r.get("businessId"), businessId),
                blank(f.action()) ? null : (r, q, cb) -> cb.equal(r.get("action"), f.action()),
                blank(f.targetType()) ? null : (r, q, cb) -> cb.equal(r.get("targetType"), f.targetType()),
                blank(f.targetId()) ? null : (r, q, cb) -> cb.equal(r.get("targetId"), f.targetId()),
                f.actorId() == null ? null : (r, q, cb) -> cb.equal(r.get("actorId"), f.actorId()),
                range == null || range.start() == null ? null
                        : (r, q, cb) -> cb.greaterThanOrEqualTo(r.get("at"), range.start()),
                range == null || range.end() == null ? null : (r, q, cb) -> cb.lessThan(r.get("at"), range.end()),
                blank(f.q()) ? null : (r, q, cb) -> {
                    String like = "%" + f.q().trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\")
                            .replace("%", "\\%").replace("_", "\\_") + "%";
                    return cb.or(cb.like(cb.lower(r.get("actorName")), like, '\\'),
                            cb.like(cb.lower(cb.coalesce(r.get("targetLabel"), "")), like, '\\'));
                });
    }

    /** Details from key / value pairs; null values are left out (unlike {@code Map.of}). */
    public static Map<String, Object> details(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            if (kv[i + 1] != null) {
                m.put(String.valueOf(kv[i]), kv[i + 1]);
            }
        }
        return m;
    }

    /** The names of a request record's fields that were sent (not null): "what changed". */
    public static String sentFields(Record r) {
        return java.util.Arrays.stream(r.getClass().getRecordComponents()).filter(c -> {
            try {
                return c.getAccessor().invoke(r) != null;
            } catch (ReflectiveOperationException e) {
                return false;
            }
        }).map(java.lang.reflect.RecordComponent::getName).collect(Collectors.joining(", "));
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static String cut(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    static ShopActivityResponse toResponse(ShopActivity a) {
        return new ShopActivityResponse(a.getId().toString(), a.getActorId() == null ? null : a.getActorId().toString(),
                a.getActorName(), a.getAction(), a.getTargetType(), a.getTargetId(), a.getTargetLabel(),
                a.getDetails(), a.getAt());
    }
}
