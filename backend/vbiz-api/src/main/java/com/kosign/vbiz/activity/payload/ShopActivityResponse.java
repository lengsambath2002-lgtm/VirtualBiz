package com.kosign.vbiz.activity.payload;

import java.time.Instant;
import java.util.Map;

public record ShopActivityResponse(String id, String actorId, String actorName, String action, String targetType,
        String targetId, String targetLabel, Map<String, Object> details, Instant at) {
}
