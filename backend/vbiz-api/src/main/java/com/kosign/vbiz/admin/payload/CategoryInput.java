package com.kosign.vbiz.admin.payload;

import com.kosign.vbiz.business.domain.BusinessType;

/**
 * {@code POST /api/admin/categories} (type, names required) and {@code PATCH /api/admin/categories/{id}}
 * (only the fields sent change; the type never does).
 */
public record CategoryInput(BusinessType businessType, String name, String nameKh, String icon, Integer tint,
        Boolean inMarketplace) {
}
