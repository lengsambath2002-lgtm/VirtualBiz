package com.kosign.vbiz.review.service;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.business.service.WorkspaceAccess;
import com.kosign.vbiz.business.service.WorkspaceAccess.Workspace;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.review.domain.Review;
import com.kosign.vbiz.review.payload.ShopReviewResponse;
import com.kosign.vbiz.review.repository.ReviewRepository;

import lombok.RequiredArgsConstructor;

/** A shop's reviews and its replies (any member reads; owner or manager replies). */
@Service
@RequiredArgsConstructor
public class ShopReviewService {

    private final ReviewRepository reviews;
    private final WorkspaceAccess access;

    @Transactional(readOnly = true)
    public List<ShopReviewResponse> list() {
        Workspace w = access.member();
        return reviews.findByBusinessIdAndHiddenAtIsNullOrderByAtDescIdAsc(w.businessId()).stream().map(ShopReviewService::toResponse)
                .toList();
    }

    @Transactional
    public ShopReviewResponse reply(UUID id, String text) {
        Workspace w = access.manager();
        Review r = reviews.findById(id).filter(x -> x.getBusinessId().equals(w.businessId()))
                .orElseThrow(() -> new BusinessException(StatusCode.REVIEW_NOT_FOUND));
        r.setReply(text == null || text.isBlank() ? null : text.trim());
        return toResponse(reviews.saveAndFlush(r));
    }

    static ShopReviewResponse toResponse(Review r) {
        return new ShopReviewResponse(r.getId().toString(), r.getTargetType(), r.getTargetId().toString(),
                r.getAuthorName(), r.getStars(), r.getText(), List.copyOf(r.getTags()), r.getVariantName(),
                r.isVerified(), r.getReply(), r.getAt());
    }
}
