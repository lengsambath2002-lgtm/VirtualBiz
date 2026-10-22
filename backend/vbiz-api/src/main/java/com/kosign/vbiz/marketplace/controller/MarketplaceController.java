package com.kosign.vbiz.marketplace.controller;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.marketplace.payload.ListingReviewResponse;
import com.kosign.vbiz.marketplace.payload.MarketDealResponse;
import com.kosign.vbiz.marketplace.payload.MarketItemResponse;
import com.kosign.vbiz.marketplace.payload.MarketShopResponse;
import com.kosign.vbiz.marketplace.payload.PromotionResponse;
import com.kosign.vbiz.marketplace.payload.SearchQuery;
import com.kosign.vbiz.marketplace.payload.SearchResultResponse;
import com.kosign.vbiz.marketplace.service.MarketplaceService;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

/** Public marketplace reads (docs/api/phase2-catalog-inventory.md § Marketplace). */
@Tag(name = "Marketplace")
@RestController
@RequestMapping("/api/marketplace")
@RequiredArgsConstructor
public class MarketplaceController extends BaseController {

    private final MarketplaceService market;

    @GetMapping("/shops")
    public ResponseEntity<ApiResponse<List<MarketShopResponse>>> shops(
            @RequestParam(required = false) Double lat, @RequestParam(required = false) Double lng,
            @RequestParam(required = false) String district) {
        return ok(market.shops(lat, lng, district));
    }

    @GetMapping("/shops/{slug}")
    public ResponseEntity<ApiResponse<MarketShopResponse>> shop(@PathVariable String slug,
            @RequestParam(required = false) Double lat, @RequestParam(required = false) Double lng,
            @RequestParam(required = false) String district) {
        return ok(market.shop(slug, lat, lng, district));
    }

    @GetMapping("/shops/{slug}/reviews")
    public ResponseEntity<ApiResponse<List<ListingReviewResponse>>> shopReviews(@PathVariable String slug) {
        return ok(market.shopReviews(slug));
    }

    @GetMapping("/items")
    public ResponseEntity<ApiResponse<List<MarketItemResponse>>> items(
            @RequestParam(required = false) String shop, @RequestParam(required = false) String type) {
        return ok(market.items(shop, type));
    }

    @GetMapping("/items/{slug}")
    public ResponseEntity<ApiResponse<MarketItemResponse>> item(@PathVariable String slug) {
        return ok(market.item(slug));
    }

    @GetMapping("/items/{slug}/reviews")
    public ResponseEntity<ApiResponse<List<ListingReviewResponse>>> itemReviews(@PathVariable String slug) {
        return ok(market.itemReviews(slug));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<SearchResultResponse>> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String min,
            @RequestParam(required = false) String max,
            @RequestParam(required = false) Double rating,
            @RequestParam(required = false) String sale,
            @RequestParam(required = false) String open,
            @RequestParam(required = false) String freeDel,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng,
            @RequestParam(required = false) String district,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + SearchQuery.DEFAULT_SIZE) int size) {
        if (page < 0) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "page", "0 or more");
        }
        if (size < 1 || size > SearchQuery.MAX_SIZE) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "size", "1 to " + SearchQuery.MAX_SIZE);
        }
        List<String> cats = category == null ? List.of()
                : Arrays.stream(category.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
        return ok(market.search(new SearchQuery(q, type, cats, amount(min, "min"), amount(max, "max"), rating,
                flag(sale), flag(open), flag(freeDel), sort, lat, lng, district, page, size)));
    }

    @GetMapping("/deals")
    public ResponseEntity<ApiResponse<List<MarketDealResponse>>> deals() {
        return ok(market.deals());
    }

    @GetMapping("/promotions")
    public ResponseEntity<ApiResponse<List<PromotionResponse>>> promotions() {
        return ok(market.platformPromotions());
    }

    private static boolean flag(String v) {
        return v != null && (v.equals("1") || v.equalsIgnoreCase("true"));
    }

    private static BigDecimal amount(String v, String field) {
        if (v == null || v.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(v.trim());
        } catch (NumberFormatException ex) {
            throw BusinessException.withDetail(StatusCode.INVALID_REQUEST, field, "Not a number");
        }
    }
}
