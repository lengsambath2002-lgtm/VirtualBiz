package com.kosign.vbiz.meta.payload;

import com.kosign.vbiz.business.domain.BusinessType;

public record CategoryResponse(String id, String name, String nameKh, String icon, int tint,
        BusinessType businessType, boolean inMarketplace) {
}
