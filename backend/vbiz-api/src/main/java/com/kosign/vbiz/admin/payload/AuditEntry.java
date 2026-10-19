package com.kosign.vbiz.admin.payload;

import java.time.Instant;
import java.util.Map;

/** One audit-log entry. */
public record AuditEntry(
        String id,
        String actorId,
        String actorName,
        String action,
        String targetType,
        String targetId,
        String targetLabel,
        String reason,
        Map<String, Object> details,
        Instant at) {
}
