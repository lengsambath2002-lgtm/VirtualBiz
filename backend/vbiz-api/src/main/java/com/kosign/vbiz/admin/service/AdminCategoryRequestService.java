package com.kosign.vbiz.admin.service;

import java.time.Clock;
import java.util.Map;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.admin.domain.AuditTarget;
import com.kosign.vbiz.admin.payload.CategoryDecisionInput;
import com.kosign.vbiz.admin.payload.ListParams;
import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.domain.CategoryRequest;
import com.kosign.vbiz.business.payload.CategoryRequestResponse;
import com.kosign.vbiz.business.repository.BusinessRepository;
import com.kosign.vbiz.business.repository.CategoryRequestRepository;
import com.kosign.vbiz.business.service.CategoryRequestService;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.list.PageResponse;
import com.kosign.vbiz.meta.payload.CategoryResponse;
import com.kosign.vbiz.meta.service.CategoryService;
import com.kosign.vbiz.notification.domain.NotificationKind;
import com.kosign.vbiz.notification.service.NotificationService;

import lombok.RequiredArgsConstructor;

/**
 * Shops' category suggestions in the console (docs/api/phase19-category-requests.md). Approving
 * makes the category (or maps to an existing one) and moves the shop; declining tells the shop why.
 * Super-admins decide, as they own the category list; every decision is audited.
 */
@Service
@RequiredArgsConstructor
public class AdminCategoryRequestService {

    private final AdminAccess access;
    private final AuditLog audit;
    private final CategoryRequestRepository requests;
    private final BusinessRepository businesses;
    private final CategoryService categories;
    private final NotificationService notifications;
    private final Clock clock;

    @Transactional(readOnly = true)
    public PageResponse<CategoryRequestResponse> list(String status, ListParams lp) {
        access.require();
        CategoryRequest.Status st = status == null || status.isBlank() ? CategoryRequest.Status.PENDING
                : CategoryRequest.Status.valueOf(status.toUpperCase(java.util.Locale.ROOT));
        var page = requests.findByStatus(st, PageRequest.of(lp.pageNo(), lp.sizeNo(),
                st == CategoryRequest.Status.PENDING ? Sort.by("createdAt").ascending()
                        : Sort.by("decidedAt").descending()));
        Map<UUID, Business> shops = new java.util.HashMap<>();
        businesses.findAllById(page.getContent().stream().map(CategoryRequest::getBusinessId).toList())
                .forEach(b -> shops.put(b.getId(), b));
        return new PageResponse<>(page.getContent().stream()
                .map(r -> CategoryRequestService.toResponse(r, shops.get(r.getBusinessId()))).toList(),
                page.getTotalElements(), lp.pageNo(), lp.sizeNo());
    }

    @Transactional(readOnly = true)
    public long pendingCount() {
        return requests.countByStatus(CategoryRequest.Status.PENDING);
    }

    @Transactional
    public CategoryRequestResponse approve(UUID id, CategoryDecisionInput in) {
        AdminAccess.Admin admin = access.requireSuper();
        CategoryRequest r = pending(id);
        Business b = businesses.findById(r.getBusinessId())
                .orElseThrow(() -> new BusinessException(StatusCode.BUSINESS_NOT_FOUND));
        CategoryResponse c;
        boolean created;
        if (in != null && in.categoryId() != null && !in.categoryId().isBlank()) {
            c = categories.all().stream().filter(x -> x.id().equals(in.categoryId())).findFirst()
                    .orElseThrow(() -> BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "categoryId",
                            "Unknown category"));
            if (c.businessType() != r.getBusinessType()) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "categoryId",
                        "A " + r.getBusinessType() + " category is needed");
            }
            created = false;
        } else {
            String name = in != null && in.name() != null && !in.name().isBlank() ? in.name() : r.getName();
            String nameKh = in != null && in.nameKh() != null && !in.nameKh().isBlank() ? in.nameKh()
                    : r.getNameKh() != null ? r.getNameKh() : name;
            c = categories.create(r.getBusinessType(), new CategoryService.Fields(name, nameKh,
                    in != null && in.icon() != null ? in.icon() : "store",
                    in != null && in.tint() != null ? in.tint() : 1, true));
            created = true;
            audit.record(admin, AuditLog.CATEGORY_CREATED, AuditTarget.CATEGORY, c.id(), c.name(), null,
                    Map.of("businessType", c.businessType().name(), "fromRequest", r.getId().toString()));
        }
        boolean move = in == null || in.moveShop() == null || in.moveShop();
        if (move) {
            b.setCategoryId(c.id());
            businesses.saveAndFlush(b);
        }
        r.setStatus(CategoryRequest.Status.APPROVED);
        r.setCategoryId(c.id());
        r.setDecidedByName(admin.name());
        r.setDecidedAt(clock.instant());
        r.setDecisionNote(in == null || in.reason() == null || in.reason().isBlank() ? null : in.reason().trim());
        requests.saveAndFlush(r);
        audit.record(admin, AuditLog.CATEGORY_REQUEST_APPROVED, AuditTarget.BUSINESS, b.getId(), b.getName(), null,
                Map.of("asked", r.getName(), "category", c.id(), "created", created, "moved", move));
        notifications.toBusiness(b.getId(), NotificationKind.CATEGORY_APPROVED,
                Map.of("asked", r.getName(), "category", c.name(), "moved", String.valueOf(move)), settings(b));
        return CategoryRequestService.toResponse(r, b);
    }

    @Transactional
    public CategoryRequestResponse reject(UUID id, String rawReason) {
        AdminAccess.Admin admin = access.requireSuper();
        String reason = AuditLog.requireReason(rawReason);
        CategoryRequest r = pending(id);
        Business b = businesses.findById(r.getBusinessId())
                .orElseThrow(() -> new BusinessException(StatusCode.BUSINESS_NOT_FOUND));
        r.setStatus(CategoryRequest.Status.REJECTED);
        r.setDecidedByName(admin.name());
        r.setDecidedAt(clock.instant());
        r.setDecisionNote(reason);
        requests.saveAndFlush(r);
        audit.record(admin, AuditLog.CATEGORY_REQUEST_REJECTED, AuditTarget.BUSINESS, b.getId(), b.getName(), reason,
                Map.of("asked", r.getName()));
        notifications.toBusiness(b.getId(), NotificationKind.CATEGORY_REJECTED,
                Map.of("asked", r.getName(), "reason", reason), settings(b));
        return CategoryRequestService.toResponse(r, b);
    }

    private CategoryRequest pending(UUID id) {
        CategoryRequest r = requests.findById(id).orElseThrow(() -> new BusinessException(StatusCode.NOT_FOUND));
        if (r.getStatus() != CategoryRequest.Status.PENDING) {
            throw BusinessException.withDetail(StatusCode.CONFLICT, "status", "Already decided");
        }
        return r;
    }

    private static String settings(Business b) {
        return b.getType() == com.kosign.vbiz.business.domain.BusinessType.SERVICE ? "/provider/settings"
                : "/seller/settings";
    }
}
