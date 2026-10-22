package com.kosign.vbiz.business.payload;

import java.time.Instant;

public record CategoryRequestResponse(String id, String businessId, String shopName, String businessType,
        String currentCategoryId, String name, String nameKh, String note, String status, String requestedByName,
        String decidedByName, Instant decidedAt, String decisionNote, String categoryId, Instant createdAt) {
}
