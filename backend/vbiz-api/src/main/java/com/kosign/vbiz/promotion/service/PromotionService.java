package com.kosign.vbiz.promotion.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.business.service.WorkspaceAccess;
import com.kosign.vbiz.business.service.WorkspaceAccess.Workspace;
import com.kosign.vbiz.catalog.domain.Product;
import com.kosign.vbiz.catalog.repository.CollectionRepository;
import com.kosign.vbiz.catalog.repository.ProductRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.helper.Money;
import com.kosign.vbiz.promotion.domain.Promotion;
import com.kosign.vbiz.promotion.domain.PromotionScope;
import com.kosign.vbiz.promotion.domain.PromotionState;
import com.kosign.vbiz.promotion.domain.PromotionType;
import com.kosign.vbiz.promotion.payload.PromotionInput;
import com.kosign.vbiz.promotion.payload.PromotionResponse;
import com.kosign.vbiz.promotion.repository.PromotionRepository;

import lombok.RequiredArgsConstructor;

/**
 * A shop's promotions (docs/api/phase5-pos-promotions-reviews.md § Promotions): codes the
 * customer types and automatic ones (no code) that checkout applies by itself.
 */
@Service
@RequiredArgsConstructor
public class PromotionService {

    static final ZoneId PHNOM_PENH = ZoneId.of("Asia/Phnom_Penh");
    static final Pattern CODE = Pattern.compile("^[A-Z0-9]{3,20}$");

    private final PromotionRepository promotions;
    private final ProductRepository products;
    private final CollectionRepository collections;
    private final WorkspaceAccess access;
    private final Clock clock;

    @Transactional(readOnly = true)
    public List<PromotionResponse> list() {
        Workspace w = access.member();
        Instant now = clock.instant();
        return promotions.findByBusinessIdOrderByStartsAtDescIdAsc(w.businessId()).stream()
                .map(p -> toResponse(p, now)).toList();
    }

    @Transactional
    public PromotionResponse create(PromotionInput in) {
        Workspace w = access.manager();
        if (in.name() == null || in.type() == null || in.value() == null || in.scope() == null
                || in.startsAt() == null || in.endsAt() == null) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "name",
                    "name, type, value, scope, startsAt and endsAt are required");
        }
        Promotion p = new Promotion();
        p.setBusinessId(w.businessId());
        p.setUses(0);
        apply(w, p, in);
        return toResponse(promotions.saveAndFlush(p), clock.instant());
    }

    @Transactional
    public PromotionResponse update(UUID id, PromotionInput in) {
        Workspace w = access.manager();
        Promotion p = own(w, id);
        apply(w, p, in);
        return toResponse(promotions.saveAndFlush(p), clock.instant());
    }

    /** "End now": it stops at the end of yesterday (Phnom Penh), as the prototype does. */
    @Transactional
    public PromotionResponse.Ended end(UUID id) {
        Workspace w = access.manager();
        Promotion p = own(w, id);
        Instant previous = p.getEndsAt();
        Instant endOfYesterday = LocalDate.now(clock.withZone(PHNOM_PENH)).atStartOfDay(PHNOM_PENH).toInstant()
                .minusMillis(1);
        p.setEndsAt(endOfYesterday);
        if (p.getStartsAt().isAfter(endOfYesterday)) {
            p.setStartsAt(endOfYesterday.minusMillis(1));
        }
        return new PromotionResponse.Ended(toResponse(promotions.saveAndFlush(p), clock.instant()), previous);
    }

    private Promotion own(Workspace w, UUID id) {
        return promotions.findById(id).filter(p -> w.businessId().equals(p.getBusinessId()))
                .orElseThrow(() -> new BusinessException(StatusCode.PROMOTION_NOT_FOUND));
    }

    private void apply(Workspace w, Promotion p, PromotionInput in) {
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
            if (code.isEmpty()) {
                p.setCode(null);
            } else {
                if (!CODE.matcher(code).matches()) {
                    throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "code", "3–20 letters or digits");
                }
                boolean taken = promotions.findByCode(code, Set.of(w.businessId())).stream()
                        .anyMatch(o -> !o.getId().equals(p.getId()));
                if (taken) {
                    throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "code", "Already used");
                }
                p.setCode(code);
            }
        }
        if (in.scope() != null) {
            p.setScope(in.scope());
        }
        if (in.targetIds() != null || in.scope() != null) {
            List<String> targets = in.targetIds() != null ? in.targetIds() : p.getTargetIds();
            p.setTargetIds(new ArrayList<>(targets(w, p.getScope(), targets)));
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

    /** Collection ids (CATEGORY) or product ids (PRODUCTS) of the shop; nothing for ALL. */
    private List<String> targets(Workspace w, PromotionScope scope, List<String> ids) {
        if (scope == PromotionScope.ALL) {
            return List.of();
        }
        Set<String> own = scope == PromotionScope.CATEGORY
                ? collections.findByBusinessIdOrderByPositionAscNameAsc(w.businessId()).stream()
                        .map(c -> c.getId().toString()).collect(Collectors.toSet())
                : products.findByBusinessIdAndDeletedAtIsNullOrderByCreatedAtDescIdAsc(w.businessId()).stream()
                        .map(Product::getId).map(UUID::toString).collect(Collectors.toSet());
        List<String> out = ids.stream().distinct().toList();
        if (out.isEmpty() || !own.containsAll(out)) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "targetIds",
                    scope == PromotionScope.CATEGORY ? "Pick the shop's collections" : "Pick the shop's products");
        }
        return out;
    }

    public static PromotionResponse toResponse(Promotion p, Instant now) {
        return new PromotionResponse(p.getId().toString(), p.getBusinessId() == null ? null : p.getBusinessId().toString(),
                p.getName(), p.getType(), p.getValue(), p.getCode(), p.getScope(), List.copyOf(p.getTargetIds()),
                p.getMinSpend(), p.getMaxDiscount(), p.getStartsAt(), p.getEndsAt(), p.getUses(), p.getUsageLimit(),
                PromotionState.derive(p.getStartsAt(), p.getEndsAt(), p.getUses(),
                        p.getUsageLimit() == null ? null : p.getUsageLimit().longValue(), now));
    }
}
