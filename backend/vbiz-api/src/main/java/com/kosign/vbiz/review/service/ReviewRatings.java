package com.kosign.vbiz.review.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

import org.springframework.stereotype.Component;

import com.kosign.vbiz.business.repository.BusinessRepository;
import com.kosign.vbiz.catalog.repository.ProductRepository;
import com.kosign.vbiz.catalog.repository.ServiceItemRepository;
import com.kosign.vbiz.review.domain.Review;
import com.kosign.vbiz.review.domain.ReviewTarget;
import com.kosign.vbiz.review.repository.ReviewRepository;

import lombok.RequiredArgsConstructor;

/**
 * Recomputes the item's and the shop's rating (and the shop's review count) from the visible
 * reviews, after a review is written, hidden or shown again. Call inside the caller's transaction.
 */
@Component
@RequiredArgsConstructor
public class ReviewRatings {

    private final ReviewRepository reviews;
    private final ProductRepository products;
    private final ServiceItemRepository services;
    private final BusinessRepository businesses;

    public void recompute(Review r) {
        reviews.flush();
        Object[] t = reviews.statsOfTarget(r.getTargetType(), r.getTargetId()).get(0);
        BigDecimal avg = avg(t[0]);
        if (r.getTargetType() == ReviewTarget.PRODUCT) {
            products.findById(r.getTargetId()).ifPresent(p -> p.setRating(avg));
        } else {
            services.findById(r.getTargetId()).ifPresent(s -> s.setRating(avg));
        }
        Object[] b = reviews.statsOfBusiness(r.getBusinessId()).get(0);
        businesses.findById(r.getBusinessId()).ifPresent(x -> {
            x.setRating(avg(b[0]));
            x.setReviewCount(((Number) b[1]).intValue());
        });
    }

    private static BigDecimal avg(Object v) {
        return v == null ? BigDecimal.ZERO : BigDecimal.valueOf(((Number) v).doubleValue()).setScale(1, RoundingMode.HALF_UP);
    }
}
