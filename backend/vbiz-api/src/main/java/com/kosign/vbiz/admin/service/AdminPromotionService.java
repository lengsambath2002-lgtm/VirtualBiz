package com.kosign.vbiz.admin.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.common.list.PageResponse;
import com.kosign.vbiz.admin.payload.ListParams;
import com.kosign.vbiz.admin.domain.AuditTarget;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.helper.Money;
import com.kosign.vbiz.meta.payload.CategoryResponse;
import com.kosign.vbiz.meta.service.ReferenceDataService;
import com.kosign.vbiz.promotion.domain.Promotion;
import com.kosign.vbiz.promotion.domain.PromotionScope;
import com.kosign.vbiz.promotion.domain.PromotionType;
import com.kosign.vbiz.promotion.payload.PromotionInput;
import com.kosign.vbiz.promotion.payload.PromotionResponse;
import com.kosign.vbiz.promotion.domain.PromotionState;
import com.kosign.vbiz.promotion.repository.PromotionRepository;
import com.kosign.vbiz.promotion.service.PromotionService;

import lombok.RequiredArgsConstructor;

/**
 * VirtualBiz's own promo codes (docs/api/phase7-admin.md § Promo codes): a {@code promotion} with
 * no shop. They always have a code (customers type it at checkout) and cover every shop, or the
 * marketplace categories in {@code targetIds}. Same body as a shop's promotion.
 */
@Service
@RequiredArgsConstructor
public class AdminPromotionService {

    private static final Pattern CODE = Pattern.compile("^[A-Z0-9]{3,20}$");

    private final AdminAccess access;
    private final AuditLog audit;
    private final PromotionRepository promotions;
    private final ReferenceDataService reference;
    private final Clock clock;

    @Transactional(readOnly = true)
    public PageResponse<PromotionResponse> list(String q, PromotionState state, ListParams lp) {
        access.require();
        Instant now = clock.instant();
        String needle = q == null ? "" : q.trim().toLowerCase(java.util.Locale.ROOT);
        String sort = lp.sort() == null ? "-starts" : lp.sort();
        java.util.Comparator<PromotionResponse> order = switch (sort.replaceFirst("^-", "")) {
            case "starts" -> java.util.Comparator.comparing(PromotionResponse::startsAt);
            case "ends" -> java.util.Comparator.comparing(PromotionResponse::endsAt);
            case "uses" -> java.util.Comparator.comparingInt(PromotionResponse::uses);
            case "name" -> java.util.Comparator.comparing(PromotionResponse::name, String.CASE_INSENSITIVE_ORDER);
            default -> throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "sort",
                    "one of starts, ends, uses, name");
        };
        if (sort.startsWith("-")) {
            order = order.reversed();
        }
        List<PromotionResponse> all = promotions.findByBusinessIdIsNullOrderByStartsAtDescIdAsc().stream()
                .map(p -> PromotionService.toResponse(p, now))
                .filter(p -> state == null || p.state() == state)
                .filter(p -> needle.isEmpty() || p.name().toLowerCase(java.util.Locale.ROOT).contains(needle)
                        || (p.code() != null && p.code().toLowerCase(java.util.Locale.ROOT).contains(needle)))
                .sorted(order).toList();
        return PageResponse.slice(all, lp.pageNo(), lp.sizeNo());
    }

    @Transactional
    public PromotionResponse create(PromotionInput in) {
        AdminAccess.Admin admin = access.require();
        if (in.name() == null || in.type() == null || in.value() == null || in.code() == null
                || in.startsAt() == null || in.endsAt() == null) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "name",
                    "name, type, value, code, startsAt and endsAt are required");
        }
        Promotion p = new Promotion();
        p.setUses(0);
        p.setScope(PromotionScope.ALL);
        apply(p, in);
        promotions.saveAndFlush(p);
        audit.record(admin, AuditLog.PROMOTION_CREATED, AuditTarget.PROMOTION, p.getId(), p.getCode(), null, null);
        return PromotionService.toResponse(p, clock.instant());
    }

    @Transactional
    public PromotionResponse update(UUID id, PromotionInput in) {
        AdminAccess.Admin admin = access.require();
        Promotion p = platform(id);
        apply(p, in);
        promotions.saveAndFlush(p);
        audit.record(admin, AuditLog.PROMOTION_UPDATED, AuditTarget.PROMOTION, p.getId(), p.getCode(), null, null);
        return PromotionService.toResponse(p, clock.instant());
    }

    /** Stops the code now (it stays in the list as ended). */
    @Transactional
    public PromotionResponse end(UUID id) {
        AdminAccess.Admin admin = access.require();
        Promotion p = platform(id);
        Instant now = clock.instant();
        if (p.getEndsAt().isAfter(now)) {
            p.setEndsAt(now);
            if (p.getStartsAt().isAfter(now)) {
                p.setStartsAt(now.minusMillis(1));
            }
        }
        promotions.saveAndFlush(p);
        audit.record(admin, AuditLog.PROMOTION_ENDED, AuditTarget.PROMOTION, p.getId(), p.getCode(), null, null);
        return PromotionService.toResponse(p, now);
    }

    private Promotion platform(UUID id) {
        return promotions.findById(id).filter(p -> p.getBusinessId() == null)
                .orElseThrow(() -> new BusinessException(StatusCode.PROMOTION_NOT_FOUND));
    }

    private void apply(Promotion p, PromotionInput in) {
        if (in.name() != null) {
            String n = in.name().trim();
            if (n.length() < 2) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "name", "2–60 characters");
            }
            p.setName(n);
        }
        if (in.type() != null) {
            p.setType(in.type());
        }
        if (in.value() != null) {
            p.setValue(Money.usd(in.value()));
        }
        if (p.getType() == PromotionType.FREE_SHIPPING) {
            p.setValue(Money.ZERO);
        } else if (p.getType() == PromotionType.PERCENT
                && (p.getValue().compareTo(BigDecimal.ONE) < 0 || p.getValue().compareTo(BigDecimal.valueOf(90)) > 0)) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "value", "1–90 %");
        } else if (p.getType() == PromotionType.FIXED && p.getValue().signum() <= 0) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "value", "More than $0");
        }
        if (in.code() != null) {
            String code = in.code().trim().toUpperCase(Locale.ROOT);
            if (!CODE.matcher(code).matches()) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "code", "3–20 letters or digits");
            }
            // Platform codes are unique among themselves (the database enforces it too); a shop may
            // have the same code, and checkout tries the platform's first.
            boolean taken = promotions.findByBusinessIdIsNullOrderByStartsAtDescIdAsc().stream()
                    .anyMatch(o -> code.equalsIgnoreCase(o.getCode()) && !o.getId().equals(p.getId()));
            if (taken) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "code", "Already used");
            }
            p.setCode(code);
        }
        if (in.scope() != null) {
            if (in.scope() == PromotionScope.PRODUCTS) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "scope",
                        "A platform code covers every shop or some categories");
            }
            p.setScope(in.scope());
        }
        if (in.targetIds() != null || in.scope() != null) {
            List<String> targets = in.targetIds() != null ? in.targetIds() : p.getTargetIds();
            p.setTargetIds(new ArrayList<>(categories(p.getScope(), targets)));
        }
        if (in.minSpend() != null) {
            p.setMinSpend(in.minSpend().signum() == 0 ? null : Money.usd(in.minSpend()));
        }
        if (in.maxDiscount() != null) {
            p.setMaxDiscount(in.maxDiscount().signum() == 0 ? null : Money.usd(in.maxDiscount()));
        }
        if (in.usageLimit() != null) {
            p.setUsageLimit(in.usageLimit() == 0 ? null : in.usageLimit());
        }
        if (in.startsAt() != null) {
            p.setStartsAt(in.startsAt());
        }
        if (in.endsAt() != null) {
            p.setEndsAt(in.endsAt());
        }
        if (!p.getEndsAt().isAfter(p.getStartsAt())) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "endsAt", "Ends before it starts");
        }
    }

    private List<String> categories(PromotionScope scope, List<String> ids) {
        if (scope != PromotionScope.CATEGORY) {
            return List.of();
        }
        Set<String> known = reference.categories(null, false).stream().map(CategoryResponse::id)
                .collect(Collectors.toSet());
        List<String> out = ids == null ? List.of() : ids.stream().distinct().toList();
        if (out.isEmpty() || !known.containsAll(out)) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "targetIds", "Pick marketplace categories");
        }
        return out;
    }
}
