package com.kosign.vbiz.marketplace.payload;

import java.util.List;

/**
 * One page of search results: {@code items} (products and services) and {@code shops}, each the
 * {@code page}-th slice of {@code size}, with how many match in all.
 */
public record SearchResultResponse(List<MarketItemResponse> items, List<MarketShopResponse> shops,
        long itemTotal, long shopTotal, int page, int size) {
}
