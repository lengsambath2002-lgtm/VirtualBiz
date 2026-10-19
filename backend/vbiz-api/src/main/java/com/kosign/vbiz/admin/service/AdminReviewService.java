package com.kosign.vbiz.admin.service;

import java.time.Clock;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.admin.domain.AuditTarget;
import com.kosign.vbiz.admin.payload.AdminReviewRow;
import com.kosign.vbiz.admin.payload.PageResponse;
import com.kosign.vbiz.admin.repository.AdminQueries;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.review.domain.Review;
import com.kosign.vbiz.review.repository.ReviewRepository;
import com.kosign.vbiz.review.service.ReviewRatings;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;

/**
 * Review moderation (docs/api/phase7-admin.md § Reviews): hiding takes a review out of every
 * public list and out of the item's and shop's ratings; restoring puts it back.
 */
@Service
@RequiredArgsConstructor
public class AdminReviewService {

    private final AdminAccess access;
    private final AdminQueries queries;
    private final AuditLog audit;
    private final ReviewRepository reviews;
    private final ReviewRatings ratings;
    private final EntityManager em;
    private final Clock clock;

    @Transactional(readOnly = true)
    public PageResponse<AdminReviewRow> list(String q, Integer stars, String status, UUID businessId, Integer page,
            Integer size) {
        access.require();
        int[] p = AuditLog.paging(page, size);
        return queries.reviews(new AdminQueries.ReviewFilter(q, stars, status, businessId, null), p[0], p[1]);
    }

    @Transactional
    public AdminReviewRow hide(UUID id, String rawReason) {
        AdminAccess.Admin admin = access.require();
        String reason = AuditLog.requireReason(rawReason);
        Review r = require(id);
        if (r.getHiddenAt() != null) {
            throw new BusinessException(StatusCode.CONFLICT);
        }
        r.setHiddenAt(clock.instant());
        r.setHiddenReason(reason);
        ratings.recompute(r);
        audit.record(admin, AuditLog.REVIEW_HIDDEN, AuditTarget.REVIEW, id, label(r), reason,
                Map.of("stars", r.getStars()));
        return row(r);
    }

    @Transactional
    public AdminReviewRow restore(UUID id, String note) {
        AdminAccess.Admin admin = access.require();
        Review r = require(id);
        if (r.getHiddenAt() == null) {
            throw new BusinessException(StatusCode.CONFLICT);
        }
        r.setHiddenAt(null);
        r.setHiddenReason(null);
        ratings.recompute(r);
        audit.record(admin, AuditLog.REVIEW_RESTORED, AuditTarget.REVIEW, id, label(r), AuditLog.optional(note),
                Map.of("stars", r.getStars()));
        return row(r);
    }

    private Review require(UUID id) {
        return reviews.findById(id).orElseThrow(() -> new BusinessException(StatusCode.REVIEW_NOT_FOUND));
    }

    private static String label(Review r) {
        return r.getAuthorName() + " · " + r.getStars() + "★";
    }

    private AdminReviewRow row(Review r) {
        em.flush();
        return queries.reviews(new AdminQueries.ReviewFilter(null, null, null, null, r.getId()), 0, 1).items().get(0);
    }
}
