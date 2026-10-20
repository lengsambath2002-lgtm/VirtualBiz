package com.kosign.vbiz.admin.service;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.admin.domain.AuditTarget;
import com.kosign.vbiz.admin.payload.AdminCategoryRow;
import com.kosign.vbiz.admin.payload.CategoryInput;
import com.kosign.vbiz.admin.repository.AdminQueries;
import com.kosign.vbiz.meta.payload.CategoryResponse;
import com.kosign.vbiz.meta.service.CategoryService;

import lombok.RequiredArgsConstructor;

/**
 * Platform categories in the console (docs/api/phase7-admin.md § Categories): staff see them with
 * their shop counts; a super-admin adds, renames, shows / hides in the marketplace and reorders.
 * A category is never deleted (shops point at it); hiding takes it out of the marketplace bar.
 */
@Service
@RequiredArgsConstructor
public class AdminCategoryService {

    private final AdminAccess access;
    private final AuditLog audit;
    private final CategoryService categories;
    private final AdminQueries queries;

    @Transactional(readOnly = true)
    public List<AdminCategoryRow> list() {
        access.require();
        return rows(categories.all());
    }

    @Transactional
    public AdminCategoryRow create(CategoryInput in) {
        AdminAccess.Admin admin = access.requireSuper();
        CategoryResponse c = categories.create(in.businessType(), fields(in));
        audit.record(admin, AuditLog.CATEGORY_CREATED, AuditTarget.CATEGORY, c.id(), c.name(), null,
                Map.of("businessType", c.businessType().name()));
        return row(c, queries.shopsPerCategory());
    }

    @Transactional
    public AdminCategoryRow update(String id, CategoryInput in) {
        AdminAccess.Admin admin = access.requireSuper();
        CategoryResponse[] r = categories.update(id, fields(in));
        CategoryResponse after = r[1];
        audit.record(admin, AuditLog.CATEGORY_UPDATED, AuditTarget.CATEGORY, id, after.name(), null,
                Map.of("inMarketplace", after.inMarketplace(), "renamed", !r[0].name().equals(after.name())));
        return row(after, queries.shopsPerCategory());
    }

    @Transactional
    public List<AdminCategoryRow> reorder(List<String> ids) {
        AdminAccess.Admin admin = access.requireSuper();
        List<CategoryResponse> all = categories.reorder(ids);
        audit.record(admin, AuditLog.CATEGORIES_REORDERED, AuditTarget.CATEGORY, "order", null, null, null);
        return rows(all);
    }

    private List<AdminCategoryRow> rows(List<CategoryResponse> all) {
        Map<String, Long> shops = queries.shopsPerCategory();
        return all.stream().map(c -> row(c, shops)).toList();
    }

    private static AdminCategoryRow row(CategoryResponse c, Map<String, Long> shops) {
        return new AdminCategoryRow(c.id(), c.name(), c.nameKh(), c.icon(), c.tint(), c.businessType(),
                c.inMarketplace(), shops.getOrDefault(c.id(), 0L));
    }

    private static CategoryService.Fields fields(CategoryInput in) {
        return new CategoryService.Fields(in.name(), in.nameKh(), in.icon(), in.tint(), in.inMarketplace());
    }
}
