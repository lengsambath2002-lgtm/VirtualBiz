package com.kosign.vbiz.admin.payload;

import com.kosign.vbiz.business.domain.BusinessType;

/** A platform category in the console, with how many shops use it. */
public record AdminCategoryRow(String id, String name, String nameKh, String icon, int tint,
        BusinessType businessType, boolean inMarketplace, long shops) {
}
