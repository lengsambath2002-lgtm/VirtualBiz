package com.kosign.vbiz.admin.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.admin.payload.AuditEntry;
import com.kosign.vbiz.admin.payload.PageResponse;
import com.kosign.vbiz.admin.repository.AdminQueries;

import lombok.RequiredArgsConstructor;

/** {@code GET /api/admin/audit}: the log of every admin action, newest first. */
@Service
@RequiredArgsConstructor
public class AdminAuditService {

    private final AdminAccess access;
    private final AdminQueries queries;

    @Transactional(readOnly = true)
    public PageResponse<AuditEntry> list(String q, String targetType, String targetId, String action, Integer page,
            Integer size) {
        access.require();
        int[] p = AuditLog.paging(page, size);
        return queries.audit(new AdminQueries.AuditFilter(q, targetType, targetId, action), p[0], p[1]);
    }
}
