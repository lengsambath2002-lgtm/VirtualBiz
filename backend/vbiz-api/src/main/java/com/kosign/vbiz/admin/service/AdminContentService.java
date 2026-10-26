package com.kosign.vbiz.admin.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.admin.domain.AuditTarget;
import com.kosign.vbiz.meta.domain.SiteContent;
import com.kosign.vbiz.meta.payload.HomeBanner;
import com.kosign.vbiz.meta.payload.HomeBanners;
import com.kosign.vbiz.meta.payload.LegalPage;
import com.kosign.vbiz.meta.service.SiteContentService;

import lombok.RequiredArgsConstructor;

/**
 * Site content in the console (docs/api/site-content.md): any staff member reads it, only a
 * super-admin changes it, and the audit entry names what changed.
 */
@Service
@RequiredArgsConstructor
public class AdminContentService {

    private final AdminAccess access;
    private final AuditLog audit;
    private final SiteContentService content;

    @Transactional(readOnly = true)
    public HomeBanners homeBanners() {
        access.require();
        return content.homeBanners();
    }

    @Transactional
    public HomeBanners saveHomeBanners(HomeBanners in) {
        AdminAccess.Admin admin = access.requireSuper();
        HomeBanners[] r = content.saveHomeBanners(in, admin.name());
        Map<String, Object> changed = new LinkedHashMap<>();
        for (var slot : List.of(
                Map.entry("main", new HomeBanner[] { r[0].main(), r[1].main() }),
                Map.entry("side1", new HomeBanner[] { r[0].side1(), r[1].side1() }),
                Map.entry("side2", new HomeBanner[] { r[0].side2(), r[1].side2() }))) {
            HomeBanner was = slot.getValue()[0];
            HomeBanner now = slot.getValue()[1];
            if (!Objects.equals(was, now)) {
                changed.put(slot.getKey(), Map.of("title", now.title().en(), "visible", now.visible()));
            }
        }
        if (!changed.isEmpty()) {
            audit.record(admin, AuditLog.CONTENT_UPDATED, AuditTarget.CONTENT, SiteContent.HOME_BANNERS, null, null,
                    changed);
        }
        return r[1];
    }

    @Transactional(readOnly = true)
    public LegalPage legal(String page) {
        access.require();
        return content.legal(page);
    }

    @Transactional
    public LegalPage saveLegal(String page, LegalPage in) {
        AdminAccess.Admin admin = access.requireSuper();
        LegalPage[] r = content.saveLegal(page, in, admin.name());
        Map<String, Object> changed = new LinkedHashMap<>();
        if (!Objects.equals(r[0].en(), r[1].en())) {
            changed.put("en", Map.of("from", r[0].en().length(), "to", r[1].en().length()));
        }
        if (!Objects.equals(r[0].kh(), r[1].kh())) {
            changed.put("kh", Map.of("from", length(r[0].kh()), "to", length(r[1].kh())));
        }
        if (!changed.isEmpty()) {
            audit.record(admin, AuditLog.CONTENT_UPDATED, AuditTarget.CONTENT, page, null, null, changed);
        }
        return r[1];
    }

    private static int length(String s) {
        return s == null ? 0 : s.length();
    }
}
