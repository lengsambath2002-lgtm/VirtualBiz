package com.kosign.vbiz.meta.service;

import java.text.Normalizer;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.meta.domain.Category;
import com.kosign.vbiz.meta.payload.CategoryResponse;
import com.kosign.vbiz.meta.repository.CategoryRepository;

import lombok.RequiredArgsConstructor;

/**
 * Writes platform categories (the console's Categories tab). Access and the audit entry are the
 * admin domain's job. Ids are slugs made from the English name and never change.
 */
@Service
@RequiredArgsConstructor
public class CategoryService {

    private static final Pattern ICON = Pattern.compile("^[a-z][a-z0-9-]{1,39}$");

    private final CategoryRepository categories;

    public record Fields(String name, String nameKh, String icon, Integer tint, Boolean inMarketplace) {
    }

    @Transactional
    public CategoryResponse create(BusinessType type, Fields in) {
        if (type == null) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "businessType", "PRODUCT or SERVICE");
        }
        String name = name(in.name(), "name");
        String base = slug(name);
        String id = base;
        for (int n = 2; categories.existsById(id); n++) {
            id = base + "-" + n;
        }
        Category c = Category.create(id, type);
        c.setSortOrder(categories.findAll().stream().mapToInt(Category::getSortOrder).max().orElse(0) + 10);
        c.setInMarketplace(in.inMarketplace() == null || in.inMarketplace());
        c.setIcon("tag");
        c.setTint((short) 1);
        apply(c, in);
        unique(c);
        return view(categories.saveAndFlush(c));
    }

    @Transactional
    public CategoryResponse[] update(String id, Fields in) {
        Category c = require(id);
        CategoryResponse before = view(c);
        apply(c, in);
        if (in.inMarketplace() != null) {
            c.setInMarketplace(in.inMarketplace());
        }
        unique(c);
        return new CategoryResponse[] {before, view(categories.saveAndFlush(c))};
    }

    /** {@code ids} is every category, in the new display order. */
    @Transactional
    public List<CategoryResponse> reorder(List<String> ids) {
        List<Category> all = categories.findAll();
        if (ids == null || ids.size() != all.size() || !new HashSet<>(ids).equals(
                all.stream().map(Category::getId).collect(Collectors.toSet()))) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "ids", "Every category id, once");
        }
        Map<String, Category> byId = all.stream().collect(Collectors.toMap(Category::getId, Function.identity()));
        for (int i = 0; i < ids.size(); i++) {
            byId.get(ids.get(i)).setSortOrder((i + 1) * 10);
        }
        categories.saveAllAndFlush(all);
        return all.stream().sorted(Comparator.comparingInt(Category::getSortOrder)).map(CategoryService::view).toList();
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> all() {
        return categories.findAll(Sort.by("sortOrder")).stream().map(CategoryService::view).toList();
    }

    public Category require(String id) {
        return categories.findById(id).orElseThrow(() -> new BusinessException(StatusCode.CATEGORY_NOT_FOUND));
    }

    private void apply(Category c, Fields in) {
        if (in.name() != null || c.getName() == null) {
            c.setName(name(in.name(), "name"));
        }
        if (in.nameKh() != null || c.getNameKh() == null) {
            c.setNameKh(name(in.nameKh(), "nameKh"));
        }
        if (in.icon() != null) {
            if (!ICON.matcher(in.icon()).matches()) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "icon", "An icon name");
            }
            c.setIcon(in.icon());
        }
        if (in.tint() != null) {
            if (in.tint() < 1 || in.tint() > 6) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "tint", "1–6");
            }
            c.setTint(in.tint().shortValue());
        }
    }

    /** Names are unique within a business type (uq_category_type_name), ignoring case. */
    private void unique(Category c) {
        boolean taken = categories.findAll().stream().anyMatch(o -> !o.getId().equals(c.getId())
                && o.getBusinessType() == c.getBusinessType() && o.getName().equalsIgnoreCase(c.getName()));
        if (taken) {
            throw BusinessException.withDetail(StatusCode.CONFLICT, "name", "Another category already has this name");
        }
    }

    private static String name(String raw, String field) {
        String v = raw == null ? "" : raw.trim();
        if (v.length() < 2 || v.length() > 40) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, field, "2–40 characters");
        }
        return v;
    }

    static String slug(String name) {
        String s = Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        s = s.length() > 34 ? s.substring(0, 34) : s;
        return s.isEmpty() ? "category" : s;
    }

    static CategoryResponse view(Category c) {
        return new CategoryResponse(c.getId(), c.getName(), c.getNameKh(), c.getIcon(), c.getTint(),
                c.getBusinessType(), c.isInMarketplace());
    }
}
