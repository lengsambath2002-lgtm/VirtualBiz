package com.kosign.vbiz.marketplace.payload;

import java.util.List;

public record SearchResultResponse(List<MarketItemResponse> items, List<MarketShopResponse> shops) {
}
