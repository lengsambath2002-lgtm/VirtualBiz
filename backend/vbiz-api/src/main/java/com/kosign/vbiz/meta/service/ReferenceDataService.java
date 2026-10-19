package com.kosign.vbiz.meta.service;

import java.util.List;
import java.util.Map;

import org.springframework.data.domain.Sort;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.meta.domain.Category;
import com.kosign.vbiz.meta.domain.District;
import com.kosign.vbiz.meta.repository.CategoryRepository;
import com.kosign.vbiz.meta.repository.DistrictRepository;
import com.kosign.vbiz.meta.payload.CategoryResponse;
import com.kosign.vbiz.meta.payload.DistrictResponse;

import lombok.RequiredArgsConstructor;

/** Lookups other domains use to validate districts and categories. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReferenceDataService {

    /**
     * Create Business chip ids that map onto a platform category (see the category seed in
     * V20261009_120000__init_reference.sql). Other chips share the platform id.
     */
    private static final Map<String, String> CATEGORY_ALIASES = Map.of(
            "cafe-food", "cafe",
            "phones-electronics", "electronics",
            "salon-barber", "salon",
            "spa-massage", "spa",
            "nails", "beauty");

    private final DistrictRepository districts;
    private final CategoryRepository categories;

    /** Districts in display order. */
    public List<DistrictResponse> districts() {
        return districts.findAll(Sort.by("sortOrder")).stream()
                .map(d -> new DistrictResponse(d.getId(), d.getName(), d.getKm().doubleValue(),
                        d.getLat() == null ? null : d.getLat().doubleValue(),
                        d.getLng() == null ? null : d.getLng().doubleValue()))
                .toList();
    }

    /** Categories in display order, optionally of one type and / or marketplace ones only. */
    public List<CategoryResponse> categories(BusinessType type, boolean marketplaceOnly) {
        return categories.findAll(Sort.by("sortOrder")).stream()
                .filter(c -> type == null || c.getBusinessType() == type)
                .filter(c -> !marketplaceOnly || c.isInMarketplace())
                .map(c -> new CategoryResponse(c.getId(), c.getName(), c.getIcon(), c.getTint(),
                        c.getBusinessType(), c.isInMarketplace()))
                .toList();
    }

    /** The canonical district name for a name or id (case-insensitive); {@code DISTRICT_NOT_FOUND} otherwise. */
    public String canonicalDistrict(String nameOrId) {
        if (nameOrId == null || nameOrId.isBlank()) {
            throw BusinessException.withDetail(StatusCode.DISTRICT_NOT_FOUND, "district", "District is required");
        }
        String v = nameOrId.trim();
        return districts.findByNameIgnoreCase(v)
                .or(() -> districts.findById(v.toLowerCase()))
                .map(District::getName)
                .orElseThrow(() -> BusinessException.withDetail(
                        StatusCode.DISTRICT_NOT_FOUND, "district", "Unknown district"));
    }

    /**
     * The platform category id for {@code id} (a platform id or a Create Business chip id) that
     * belongs to {@code type}. {@code CATEGORY_NOT_FOUND} when unknown or of the other type.
     */
    public String requireCategory(String id, BusinessType type) {
        if (id == null || id.isBlank()) {
            throw BusinessException.withDetail(StatusCode.CATEGORY_NOT_FOUND, "categoryId", "Category is required");
        }
        String key = CATEGORY_ALIASES.getOrDefault(id.trim(), id.trim());
        Category category = categories.findById(key)
                .orElseThrow(() -> BusinessException.withDetail(
                        StatusCode.CATEGORY_NOT_FOUND, "categoryId", "Unknown category"));
        if (category.getBusinessType() != type) {
            throw BusinessException.withDetail(
                    StatusCode.CATEGORY_NOT_FOUND, "categoryId", "Category is not for " + type + " businesses");
        }
        return category.getId();
    }
}
