package com.kosign.vbiz.meta.service;

import java.time.Clock;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.meta.domain.SiteContent;
import com.kosign.vbiz.meta.payload.HomeBanner;
import com.kosign.vbiz.meta.payload.HomeBanners;
import com.kosign.vbiz.meta.payload.LegalPage;
import com.kosign.vbiz.meta.payload.Localized;
import com.kosign.vbiz.meta.repository.SiteContentRepository;
import com.kosign.vbiz.storage.domain.FilePurpose;
import com.kosign.vbiz.storage.service.StorageService;

import lombok.RequiredArgsConstructor;

/**
 * The homepage banners and the legal pages (docs/api/site-content.md): anyone reads them, the
 * console's {@code AdminContentService} changes them (super-admin, audited). Every saved value is
 * checked here, so the storefront can show what it reads as it is.
 */
@Service
@RequiredArgsConstructor
public class SiteContentService {

    public static final Set<String> LEGAL = Set.of(SiteContent.TERMS, SiteContent.PRIVACY);
    static final int EYEBROW_MAX = 40;
    static final int TITLE_MAX = 90;
    static final int BODY_MAX = 160;
    static final int CTA_MAX = 30;
    static final int LEGAL_MAX = 30_000;
    // A page of this site ("/deals", "/search?type=service") or an https address. No "//host".
    private static final Pattern HREF = Pattern.compile("^(/(?!/)[\\w\\-./?=&%,+#]*|https://[^\\s<>\"]{3,})$");

    private final SiteContentRepository content;
    private final ObjectMapper json;
    private final StorageService storage;
    private final Clock clock;

    @Transactional(readOnly = true)
    public HomeBanners homeBanners() {
        SiteContent row = require(SiteContent.HOME_BANNERS);
        HomeBanners b = read(row, HomeBanners.class);
        return new HomeBanners(b.main(), b.side1(), b.side2(), row.getUpdatedAt(), row.getUpdatedBy());
    }

    @Transactional(readOnly = true)
    public LegalPage legal(String page) {
        SiteContent row = require(legalKey(page));
        LegalPage p = read(row, LegalPage.class);
        return new LegalPage(p.en(), p.kh(), row.getUpdatedAt(), row.getUpdatedBy());
    }

    /** Saves the banners after checking them; returns {before, after}. */
    @Transactional
    public HomeBanners[] saveHomeBanners(HomeBanners in, String by, UUID byId) {
        HomeBanners before = homeBanners();
        HomeBanners clean = new HomeBanners(banner("main", in.main(), before.main(), byId, true),
                banner("side1", in.side1(), before.side1(), byId, false),
                banner("side2", in.side2(), before.side2(), byId, false), null, null);
        write(SiteContent.HOME_BANNERS, clean, by);
        return new HomeBanners[] { before, homeBanners() };
    }

    /** Saves a legal page after checking it; returns {before, after}. */
    @Transactional
    public LegalPage[] saveLegal(String page, LegalPage in, String by) {
        String key = legalKey(page);
        LegalPage before = legal(key);
        String en = in.en() == null ? "" : in.en().strip();
        String kh = in.kh() == null ? "" : in.kh().strip();
        if (en.isEmpty()) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "en", "Enter the English text");
        }
        if (en.length() > LEGAL_MAX || kh.length() > LEGAL_MAX) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, en.length() > LEGAL_MAX ? "en" : "kh",
                    "At most " + LEGAL_MAX + " characters");
        }
        write(key, new LegalPage(en, kh, null, null), by);
        return new LegalPage[] { before, legal(key) };
    }

    private HomeBanner banner(String slot, HomeBanner b, HomeBanner was, UUID byId, boolean main) {
        if (b == null) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, slot, "Missing banner");
        }
        Localized eyebrow = text(slot + ".eyebrow", b.eyebrow(), EYEBROW_MAX, false);
        Localized title = text(slot + ".title", b.title(), TITLE_MAX, b.visible());
        Localized body = text(slot + ".body", b.body(), BODY_MAX, false);
        Localized cta = main ? text(slot + ".cta", b.cta(), CTA_MAX, b.visible()) : Localized.EMPTY;
        String href = b.href() == null ? "" : b.href().strip();
        if (!HREF.matcher(href).matches()) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, slot + ".href",
                    "Use a page of this site (/deals) or an https:// address");
        }
        // A new photo must be one this admin uploaded for a banner; the one already there stays.
        String image = b.imageUrl() == null || b.imageUrl().isBlank() ? null : b.imageUrl().strip();
        if (image != null && (was == null || !image.equals(was.imageUrl()))) {
            image = storage.requireOwnImage(image, byId, slot + ".imageUrl", Set.of(FilePurpose.SITE_BANNER));
        }
        return new HomeBanner(b.visible(), eyebrow, title, body, cta, href, image);
    }

    private static Localized text(String field, Localized in, int max, boolean required) {
        Localized t = in == null ? Localized.EMPTY : in.trimmed();
        if (required && t.en().isEmpty()) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, field + ".en", "Enter the English text");
        }
        if (t.en().length() > max || t.kh().length() > max) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED,
                    field + (t.en().length() > max ? ".en" : ".kh"), "At most " + max + " characters");
        }
        return t;
    }

    private static String legalKey(String page) {
        if (!LEGAL.contains(page)) {
            throw new BusinessException(StatusCode.NOT_FOUND);
        }
        return page;
    }

    private SiteContent require(String key) {
        return content.findById(key).orElseThrow(() -> new BusinessException(StatusCode.NOT_FOUND));
    }

    private <T> T read(SiteContent row, Class<T> type) {
        try {
            return json.readValue(row.getBody(), type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("site_content " + row.getKey() + " is not valid JSON", e);
        }
    }

    private void write(String key, Object body, String by) {
        SiteContent row = require(key);
        try {
            row.setBody(json.writeValueAsString(body));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
        row.setUpdatedAt(clock.instant());
        row.setUpdatedBy(by);
        content.saveAndFlush(row);
    }
}
