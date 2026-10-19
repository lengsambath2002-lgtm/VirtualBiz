package com.kosign.vbiz.promotion.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.business.service.WorkspaceAccess;
import com.kosign.vbiz.business.service.WorkspaceAccess.Workspace;
import com.kosign.vbiz.catalog.domain.ServiceItem;
import com.kosign.vbiz.catalog.repository.ServiceItemRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.promotion.domain.Deal;
import com.kosign.vbiz.promotion.payload.DealInput;
import com.kosign.vbiz.promotion.payload.DealResponse;
import com.kosign.vbiz.promotion.repository.DealRepository;

import lombok.RequiredArgsConstructor;

/**
 * A shop's deals (docs/api/phase4-bookings-provider.md § Team, deals, review replies). Reading is
 * for any member; writing needs an owner or manager. A deal runs from its start day 00:00 to the end
 * of its end day, Phnom Penh time.
 */
@Service
@RequiredArgsConstructor
public class DealService {

    static final ZoneId PHNOM_PENH = ZoneId.of("Asia/Phnom_Penh");

    private final DealRepository deals;
    private final ServiceItemRepository services;
    private final WorkspaceAccess access;

    @Transactional(readOnly = true)
    public List<DealResponse> list() {
        Workspace w = access.member();
        return deals.findByBusinessIdOrderByStartsAtDescIdAsc(w.businessId()).stream().map(DealService::toResponse)
                .toList();
    }

    @Transactional
    public DealResponse create(DealInput in) {
        Workspace w = access.manager();
        if (in.title() == null || in.start() == null || in.end() == null) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "title",
                    "title, start and end are required");
        }
        Deal d = new Deal();
        d.setBusinessId(w.businessId());
        d.setBody("");
        d.setViews(0);
        apply(w, d, in);
        return toResponse(deals.saveAndFlush(d));
    }

    @Transactional
    public DealResponse update(UUID id, DealInput in) {
        Workspace w = access.manager();
        Deal d = own(w, id);
        apply(w, d, in);
        return toResponse(deals.saveAndFlush(d));
    }

    @Transactional
    public void delete(UUID id) {
        Workspace w = access.manager();
        deals.delete(own(w, id));
    }

    private Deal own(Workspace w, UUID id) {
        return deals.findById(id).filter(d -> d.getBusinessId().equals(w.businessId()))
                .orElseThrow(() -> new BusinessException(StatusCode.PROMOTION_NOT_FOUND));
    }

    private void apply(Workspace w, Deal d, DealInput in) {
        if (in.title() != null) {
            d.setTitle(required(in.title(), "title"));
        }
        if (in.body() != null) {
            // The description is optional (the form allows it empty).
            d.setBody(in.body().trim());
        }
        if (in.discountPct() != null) {
            d.setDiscountPct(in.discountPct() == 0 ? null : in.discountPct());
        }
        if (in.serviceIds() != null) {
            Set<UUID> own = services.findByBusinessIdAndDeletedAtIsNullOrderByPositionAscCreatedAtAsc(w.businessId())
                    .stream().map(ServiceItem::getId).collect(Collectors.toSet());
            if (!own.containsAll(in.serviceIds())) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "serviceIds",
                        "Only this shop's services");
            }
            d.setServiceIds(new ArrayList<>(in.serviceIds().stream().distinct().map(UUID::toString).toList()));
        }
        LocalDate start = in.start() != null ? in.start() : dayOf(d.getStartsAt());
        LocalDate end = in.end() != null ? in.end() : dayOf(d.getEndsAt());
        if (end.isBefore(start)) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "end", "Ends before it starts");
        }
        d.setStartsAt(start.atStartOfDay(PHNOM_PENH).toInstant());
        d.setEndsAt(end.plusDays(1).atStartOfDay(PHNOM_PENH).toInstant().minusSeconds(1));
    }

    private static String required(String raw, String field) {
        String v = raw.trim();
        if (v.isEmpty()) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, field, "Required");
        }
        return v;
    }

    static LocalDate dayOf(Instant at) {
        return at.atZone(PHNOM_PENH).toLocalDate();
    }

    public static DealResponse toResponse(Deal d) {
        return new DealResponse(d.getId().toString(), d.getBusinessId().toString(), d.getTitle(), d.getBody(),
                d.getDiscountPct(), List.copyOf(d.getServiceIds()), dayOf(d.getStartsAt()).toString(),
                dayOf(d.getEndsAt()).toString(), d.getStartsAt(), d.getEndsAt(), d.getViews());
    }
}
