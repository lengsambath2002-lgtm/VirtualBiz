package com.kosign.vbiz.promotion.service;

import java.time.Clock;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.promotion.domain.Deal;
import com.kosign.vbiz.promotion.domain.Promotion;
import com.kosign.vbiz.promotion.repository.DealRepository;
import com.kosign.vbiz.promotion.repository.PromotionRepository;

import lombok.RequiredArgsConstructor;

/** Read side of promotions for the marketplace: platform codes and deals running now. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PromotionQueryService {

    private final PromotionRepository promotions;
    private final DealRepository deals;
    private final Clock clock;

    public List<Promotion> activePlatformCodes() {
        return promotions.activePlatform(clock.instant());
    }

    public List<Deal> activeDeals() {
        return deals.active(clock.instant());
    }
}
