package com.kosign.vbiz.review.service;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.review.domain.Review;
import com.kosign.vbiz.review.domain.ReviewTarget;
import com.kosign.vbiz.review.repository.ReviewRepository;

import lombok.RequiredArgsConstructor;

/** Read side of reviews (newest first). Customers write them in MyReviewService; shops reply in ShopReviewService. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReviewQueryService {

    private final ReviewRepository reviews;

    public List<Review> ofTarget(ReviewTarget type, UUID targetId) {
        return reviews.findByTargetTypeAndTargetIdAndHiddenAtIsNullOrderByAtDescIdAsc(type, targetId);
    }

    public List<Review> ofBusiness(UUID businessId) {
        return reviews.findByBusinessIdAndHiddenAtIsNullOrderByAtDescIdAsc(businessId);
    }
}
