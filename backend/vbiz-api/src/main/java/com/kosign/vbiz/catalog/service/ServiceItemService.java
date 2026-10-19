package com.kosign.vbiz.catalog.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.business.domain.BusinessMember;
import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.service.MembershipService;
import com.kosign.vbiz.business.service.WorkspaceAccess;
import com.kosign.vbiz.business.service.WorkspaceAccess.Workspace;
import com.kosign.vbiz.catalog.domain.ServiceItem;
import com.kosign.vbiz.catalog.mapper.CatalogMapper;
import com.kosign.vbiz.catalog.payload.ProviderServiceResponse;
import com.kosign.vbiz.catalog.payload.ServiceInput;
import com.kosign.vbiz.catalog.repository.ServiceItemRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.helper.Money;

import lombok.RequiredArgsConstructor;

/** The provider's services (Service Provider prototype: services page and form). */
@Service
@RequiredArgsConstructor
public class ServiceItemService {

    private final WorkspaceAccess access;
    private final MembershipService membership;
    private final ServiceItemRepository services;
    private final ListingSlugs slugs;
    private final Clock clock;

    @Transactional(readOnly = true)
    public List<ProviderServiceResponse> list() {
        Workspace w = serviceWorkspace(false);
        return services.findByBusinessIdAndDeletedAtIsNullOrderByPositionAscCreatedAtAsc(w.businessId()).stream()
                .map(CatalogMapper::toProvider).toList();
    }

    @Transactional
    public ProviderServiceResponse create(ServiceInput in) {
        Workspace w = serviceWorkspace(true);
        if (in == null || in.name() == null || in.category() == null || in.durationMin() == null
                || in.price() == null || in.staffIds() == null || in.bookableOnline() == null) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "body",
                    "name, category, durationMin, price, staffIds and bookableOnline are required");
        }
        ServiceItem s = new ServiceItem();
        s.setBusinessId(w.businessId());
        s.setPosition(services.maxPosition(w.businessId()) + 1);
        apply(w, s, in);
        s.setSlug(slugs.unique(s.getName()));
        return CatalogMapper.toProvider(services.saveAndFlush(s));
    }

    @Transactional
    public ProviderServiceResponse update(UUID id, ServiceInput in) {
        Workspace w = serviceWorkspace(true);
        ServiceItem s = require(w, id);
        if (in != null) {
            apply(w, s, in);
        }
        return CatalogMapper.toProvider(services.saveAndFlush(s));
    }

    @Transactional
    public void delete(UUID id) {
        Workspace w = serviceWorkspace(true);
        ServiceItem s = require(w, id);
        s.setDeletedAt(clock.instant());
        services.saveAndFlush(s);
    }

    private Workspace serviceWorkspace(boolean write) {
        Workspace w = write ? access.manager() : access.member();
        WorkspaceAccess.requireType(w, BusinessType.SERVICE);
        return w;
    }

    private ServiceItem require(Workspace w, UUID id) {
        return services.findByIdAndBusinessIdAndDeletedAtIsNull(id, w.businessId())
                .orElseThrow(() -> new BusinessException(StatusCode.SERVICE_NOT_FOUND));
    }

    /** Applies the present fields (absent = unchanged), validating each. */
    private void apply(Workspace w, ServiceItem s, ServiceInput in) {
        if (in.name() != null) {
            String name = in.name().trim();
            if (name.length() < 2 || name.length() > 60) {
                throw fail("name", "Name must be 2–60 characters");
            }
            UUID self = s.getId() == null ? UUID.randomUUID() : s.getId();
            if (services.nameTaken(w.businessId(), name, self)) {
                throw BusinessException.withDetail(StatusCode.CONFLICT, "name", "A service with this name exists");
            }
            s.setName(name);
        }
        if (in.category() != null) {
            String c = in.category().trim();
            if (c.isEmpty() || c.length() > 40) {
                throw fail("category", "Category must be 1–40 characters");
            }
            s.setCategory(c);
        }
        if (in.description() != null) {
            String d = in.description().trim();
            if (d.length() > 500) {
                throw fail("description", "Description is too long");
            }
            s.setDescription(d);
        }
        if (in.durationMin() != null) {
            int d = in.durationMin();
            if (d < 5 || d > 600 || d % 5 != 0) {
                throw fail("durationMin", "Duration must be 5–600 minutes in steps of 5");
            }
            s.setDurationMin(d);
        }
        if (in.price() != null) {
            BigDecimal p = Money.usd(in.price());
            if (p.signum() <= 0) {
                throw fail("price", "Price must be more than 0");
            }
            s.setPrice(p);
        }
        if (in.discountPct() != null) {
            int d = in.discountPct();
            if (d < 0 || d > 90) {
                throw fail("discountPct", "Discount must be 0–90%");
            }
            s.setDiscountPct(d == 0 ? null : d);
        }
        if (in.staffIds() != null) {
            Set<UUID> active = membership.members(w.businessId()).stream().filter(BusinessMember::isActive)
                    .map(BusinessMember::getId).collect(Collectors.toSet());
            Set<UUID> ids = new LinkedHashSet<>();
            for (String raw : in.staffIds()) {
                UUID id;
                try {
                    id = UUID.fromString(raw);
                } catch (IllegalArgumentException | NullPointerException ex) {
                    id = null;
                }
                if (id == null || !active.contains(id)) {
                    throw BusinessException.withDetail(StatusCode.MEMBER_NOT_FOUND, "staffIds",
                            "Not a staff member of this shop");
                }
                ids.add(id);
            }
            if (ids.isEmpty()) {
                throw fail("staffIds", "Choose at least one staff member");
            }
            s.getStaffIds().clear();
            s.getStaffIds().addAll(ids);
        }
        if (in.bookableOnline() != null) {
            s.setBookableOnline(in.bookableOnline());
        }
    }

    private static BusinessException fail(String field, String message) {
        return BusinessException.withDetail(StatusCode.VALIDATION_FAILED, field, message);
    }
}
