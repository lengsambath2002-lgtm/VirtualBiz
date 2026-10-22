package com.kosign.vbiz.business.service;

import java.time.Clock;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.activity.service.ShopActivityLog;
import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.domain.CategoryRequest;
import com.kosign.vbiz.business.payload.CategoryRequestInput;
import com.kosign.vbiz.business.payload.CategoryRequestResponse;
import com.kosign.vbiz.business.repository.CategoryRequestRepository;
import com.kosign.vbiz.business.service.WorkspaceAccess.Workspace;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.meta.service.CategoryService;

import lombok.RequiredArgsConstructor;

/**
 * A shop suggests a marketplace category (docs/api/phase19-category-requests.md). The platform keeps
 * the category list curated: the suggestion waits for platform staff, who approve it as a new
 * category, map it to an existing one, or decline it. One open suggestion per shop.
 */
@Service
@RequiredArgsConstructor
public class CategoryRequestService {

    private final WorkspaceAccess access;
    private final CategoryRequestRepository requests;
    private final CategoryService categories;
    private final ShopActivityLog activity;
    private final Clock clock;

    @Transactional(readOnly = true)
    public List<CategoryRequestResponse> mine() {
        Workspace w = access.member();
        return requests.findByBusinessIdOrderByCreatedAtDesc(w.businessId()).stream()
                .map(r -> toResponse(r, w.business())).toList();
    }

    @Transactional
    public CategoryRequestResponse submit(CategoryRequestInput in) {
        Workspace w = access.manager();
        if (requests.findByBusinessIdAndStatus(w.businessId(), CategoryRequest.Status.PENDING).isPresent()) {
            throw BusinessException.withDetail(StatusCode.CONFLICT, "name",
                    "Your shop already has a suggestion waiting");
        }
        String name = clean(in.name());
        boolean exists = categories.all().stream().anyMatch(c -> c.businessType() == w.business().getType()
                && (c.name().equalsIgnoreCase(name) || (c.nameKh() != null && c.nameKh().equalsIgnoreCase(name))));
        if (exists) {
            throw BusinessException.withDetail(StatusCode.CONFLICT, "name",
                    "This category exists already: pick it in your shop settings");
        }
        CategoryRequest r = new CategoryRequest();
        r.setBusinessId(w.businessId());
        r.setBusinessType(w.business().getType());
        r.setName(name);
        r.setNameKh(in.nameKh() == null || in.nameKh().isBlank() ? null : clean(in.nameKh()));
        r.setNote(in.note() == null || in.note().isBlank() ? null : in.note().trim());
        r.setRequestedBy(w.userId());
        r.setRequestedByName(w.actorName());
        requests.saveAndFlush(r);
        activity.record(w, ShopActivityLog.CATEGORY_REQUESTED, "SHOP", r.getId(), name, Map.of());
        return toResponse(r, w.business());
    }

    @Transactional
    public CategoryRequestResponse withdraw(UUID id) {
        Workspace w = access.manager();
        CategoryRequest r = requests.findById(id).filter(x -> x.getBusinessId().equals(w.businessId()))
                .orElseThrow(() -> new BusinessException(StatusCode.NOT_FOUND));
        if (r.getStatus() != CategoryRequest.Status.PENDING) {
            throw BusinessException.withDetail(StatusCode.CONFLICT, "status", "Already decided");
        }
        r.setStatus(CategoryRequest.Status.WITHDRAWN);
        r.setDecidedAt(clock.instant());
        requests.saveAndFlush(r);
        return toResponse(r, w.business());
    }

    private static String clean(String s) {
        String t = s.trim().replaceAll("\\s+", " ");
        return t.isEmpty() ? t : t.substring(0, 1).toUpperCase(Locale.ROOT) + t.substring(1);
    }

    public static CategoryRequestResponse toResponse(CategoryRequest r, Business b) {
        return new CategoryRequestResponse(r.getId().toString(), r.getBusinessId().toString(),
                b == null ? null : b.getName(), r.getBusinessType().name(), b == null ? null : b.getCategoryId(),
                r.getName(), r.getNameKh(), r.getNote(), r.getStatus().name(), r.getRequestedByName(),
                r.getDecidedByName(), r.getDecidedAt(), r.getDecisionNote(), r.getCategoryId(), r.getCreatedAt());
    }
}
