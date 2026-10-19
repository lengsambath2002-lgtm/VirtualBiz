package com.kosign.vbiz.marketplace.payload;

/** {@code MarketItem}: a listed product or service, told apart by {@code type}. */
public sealed interface MarketItemResponse permits MarketProductResponse, MarketServiceResponse {

    String type();

    String id();

    String slug();

    String shopSlug();
}
