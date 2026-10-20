package com.kosign.vbiz.admin.service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.admin.domain.AuditTarget;
import com.kosign.vbiz.admin.payload.SettingsInput;
import com.kosign.vbiz.meta.payload.PlatformSettingsResponse;
import com.kosign.vbiz.meta.service.PlatformSettingsService;

import lombok.RequiredArgsConstructor;

/**
 * Platform settings in the console (docs/api/phase7-admin.md § Settings): any staff member reads
 * them, only a super-admin changes them, and the audit entry keeps the old and new values.
 */
@Service
@RequiredArgsConstructor
public class AdminSettingsService {

    private final AdminAccess access;
    private final AuditLog audit;
    private final PlatformSettingsService settings;

    @Transactional(readOnly = true)
    public PlatformSettingsResponse get() {
        access.require();
        return settings.current();
    }

    @Transactional
    public PlatformSettingsResponse update(SettingsInput in) {
        AdminAccess.Admin admin = access.requireSuper();
        PlatformSettingsResponse[] r = settings.update(in.commissionPct(), in.payoutDelayDays(), in.khrPerUsd(),
                admin.name());
        PlatformSettingsResponse before = r[0];
        PlatformSettingsResponse after = r[1];
        Map<String, Object> changed = new LinkedHashMap<>();
        if (before.commissionPct().compareTo(after.commissionPct()) != 0) {
            changed.put("commissionPct", Map.of("from", before.commissionPct(), "to", after.commissionPct()));
        }
        if (before.payoutDelayDays() != after.payoutDelayDays()) {
            changed.put("payoutDelayDays", Map.of("from", before.payoutDelayDays(), "to", after.payoutDelayDays()));
        }
        if (!Objects.equals(before.khrPerUsd(), after.khrPerUsd())) {
            changed.put("khrPerUsd", Map.of("from", before.khrPerUsd(), "to", after.khrPerUsd()));
        }
        if (!changed.isEmpty()) {
            audit.record(admin, AuditLog.SETTINGS_UPDATED, AuditTarget.SETTINGS, "platform", null, null, changed);
        }
        return after;
    }
}
