package com.kosign.vbiz.admin.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.admin.payload.AdminBusinessDetail;
import com.kosign.vbiz.admin.payload.AdminBusinessRow;
import com.kosign.vbiz.admin.payload.AdminCategoryRow;
import com.kosign.vbiz.admin.payload.AdminOrderDetail;
import com.kosign.vbiz.admin.payload.AdminOrderRow;
import com.kosign.vbiz.admin.payload.AdminReviewRow;
import com.kosign.vbiz.admin.payload.AdminUserDetail;
import com.kosign.vbiz.admin.payload.AdminUserRow;
import com.kosign.vbiz.admin.payload.AuditEntry;
import com.kosign.vbiz.admin.payload.CategoryInput;
import com.kosign.vbiz.admin.payload.IdPhotoResponse;
import com.kosign.vbiz.admin.payload.OverviewResponse;
import com.kosign.vbiz.admin.payload.PageResponse;
import com.kosign.vbiz.admin.payload.PayoutBalance;
import com.kosign.vbiz.admin.payload.PayoutInput;
import com.kosign.vbiz.admin.payload.PayoutResponse;
import com.kosign.vbiz.admin.payload.ReasonInput;
import com.kosign.vbiz.admin.payload.RefundInput;
import com.kosign.vbiz.admin.payload.RoleInput;
import com.kosign.vbiz.admin.payload.SettingsInput;
import com.kosign.vbiz.admin.service.AdminAuditService;
import com.kosign.vbiz.admin.service.AdminBusinessService;
import com.kosign.vbiz.admin.service.AdminCategoryService;
import com.kosign.vbiz.admin.service.AdminOrderService;
import com.kosign.vbiz.admin.service.AdminOverviewService;
import com.kosign.vbiz.admin.service.AdminPayoutService;
import com.kosign.vbiz.admin.service.AdminPromotionService;
import com.kosign.vbiz.admin.service.AdminReviewService;
import com.kosign.vbiz.admin.service.AdminSettingsService;
import com.kosign.vbiz.admin.service.AdminUserService;
import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.domain.VerificationStatus;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.meta.payload.PlatformSettingsResponse;
import com.kosign.vbiz.promotion.payload.PromotionInput;
import com.kosign.vbiz.promotion.payload.PromotionResponse;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * The super-admin console (docs/api/phase7-admin.md). Staff only ({@code ADMIN_ONLY} otherwise);
 * never sends {@code X-Business-Id}. Lists take {@code page} (0-based) and {@code size} (≤ 100).
 */
@Tag(name = "Admin")
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController extends BaseController {

    private final AdminOverviewService overview;
    private final AdminBusinessService businesses;
    private final AdminUserService users;
    private final AdminOrderService orders;
    private final AdminReviewService reviews;
    private final AdminPromotionService promotions;
    private final AdminPayoutService payouts;
    private final AdminAuditService audit;
    private final AdminSettingsService settings;
    private final AdminCategoryService categories;

    @GetMapping("/overview")
    public ResponseEntity<ApiResponse<OverviewResponse>> overview(@RequestParam(required = false) Integer days) {
        return ok(overview.overview(days));
    }

    // ── Shops ──

    @GetMapping("/businesses")
    public ResponseEntity<ApiResponse<PageResponse<AdminBusinessRow>>> businesses(
            @RequestParam(required = false) String q, @RequestParam(required = false) BusinessType type,
            @RequestParam(required = false) VerificationStatus verification,
            @RequestParam(required = false) String status, @RequestParam(required = false) String sort,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return ok(businesses.list(q, type, verification, status, sort, page, size));
    }

    @GetMapping("/businesses/{id}")
    public ResponseEntity<ApiResponse<AdminBusinessDetail>> business(@PathVariable UUID id) {
        return ok(businesses.get(id));
    }

    @GetMapping("/businesses/{id}/id-photo")
    public ResponseEntity<ApiResponse<IdPhotoResponse>> idPhoto(@PathVariable UUID id) {
        return ok(businesses.idPhoto(id));
    }

    @PostMapping("/businesses/{id}/verify")
    public ResponseEntity<ApiResponse<AdminBusinessDetail>> verify(@PathVariable UUID id,
            @Valid @RequestBody(required = false) ReasonInput in) {
        return ok(businesses.verify(id, reason(in)));
    }

    @PostMapping("/businesses/{id}/reject")
    public ResponseEntity<ApiResponse<AdminBusinessDetail>> reject(@PathVariable UUID id,
            @Valid @RequestBody ReasonInput in) {
        return ok(businesses.reject(id, in.reason()));
    }

    @PostMapping("/businesses/{id}/suspend")
    public ResponseEntity<ApiResponse<AdminBusinessDetail>> suspendBusiness(@PathVariable UUID id,
            @Valid @RequestBody ReasonInput in) {
        return ok(businesses.suspend(id, in.reason()));
    }

    @PostMapping("/businesses/{id}/reinstate")
    public ResponseEntity<ApiResponse<AdminBusinessDetail>> reinstateBusiness(@PathVariable UUID id,
            @Valid @RequestBody(required = false) ReasonInput in) {
        return ok(businesses.reinstate(id, reason(in)));
    }

    // ── Users ──

    @GetMapping("/users")
    public ResponseEntity<ApiResponse<PageResponse<AdminUserRow>>> users(@RequestParam(required = false) String q,
            @RequestParam(required = false) String kind, @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return ok(users.list(q, kind, status, page, size));
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<ApiResponse<AdminUserDetail>> user(@PathVariable UUID id) {
        return ok(users.get(id));
    }

    @PostMapping("/users/{id}/suspend")
    public ResponseEntity<ApiResponse<AdminUserDetail>> suspendUser(@PathVariable UUID id,
            @Valid @RequestBody ReasonInput in) {
        return ok(users.suspend(id, in.reason()));
    }

    @PostMapping("/users/{id}/reinstate")
    public ResponseEntity<ApiResponse<AdminUserDetail>> reinstateUser(@PathVariable UUID id,
            @Valid @RequestBody(required = false) ReasonInput in) {
        return ok(users.reinstate(id, reason(in)));
    }

    @PostMapping("/users/{id}/sign-out")
    public ResponseEntity<ApiResponse<AdminUserDetail>> signOut(@PathVariable UUID id,
            @Valid @RequestBody(required = false) ReasonInput in) {
        return ok(users.signOut(id, reason(in)));
    }

    @PutMapping("/users/{id}/role")
    public ResponseEntity<ApiResponse<AdminUserDetail>> role(@PathVariable UUID id, @RequestBody RoleInput in) {
        return ok(users.setRole(id, in.role()));
    }

    // ── Orders ──

    @GetMapping("/orders")
    public ResponseEntity<ApiResponse<PageResponse<AdminOrderRow>>> orders(@RequestParam(required = false) String q,
            @RequestParam(required = false) String status, @RequestParam(required = false) UUID businessId,
            @RequestParam(required = false) UUID customerId, @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ok(orders.list(q, status, businessId, customerId, page, size));
    }

    @GetMapping("/orders/{number}")
    public ResponseEntity<ApiResponse<AdminOrderDetail>> order(@PathVariable String number) {
        return ok(orders.get(number));
    }

    @PostMapping("/orders/{number}/cancel")
    public ResponseEntity<ApiResponse<AdminOrderDetail>> cancel(@PathVariable String number,
            @Valid @RequestBody ReasonInput in) {
        return ok(orders.cancel(number, in.reason()));
    }

    @PostMapping("/orders/{number}/refund")
    public ResponseEntity<ApiResponse<AdminOrderDetail>> refund(@PathVariable String number,
            @Valid @RequestBody RefundInput in) {
        return ok(orders.refund(number, in.reason(), in.restock()));
    }

    // ── Reviews ──

    @GetMapping("/reviews")
    public ResponseEntity<ApiResponse<PageResponse<AdminReviewRow>>> reviews(
            @RequestParam(required = false) String q, @RequestParam(required = false) Integer stars,
            @RequestParam(required = false) String status, @RequestParam(required = false) UUID businessId,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return ok(reviews.list(q, stars, status, businessId, page, size));
    }

    @PostMapping("/reviews/{id}/hide")
    public ResponseEntity<ApiResponse<AdminReviewRow>> hide(@PathVariable UUID id, @Valid @RequestBody ReasonInput in) {
        return ok(reviews.hide(id, in.reason()));
    }

    @PostMapping("/reviews/{id}/restore")
    public ResponseEntity<ApiResponse<AdminReviewRow>> restore(@PathVariable UUID id,
            @Valid @RequestBody(required = false) ReasonInput in) {
        return ok(reviews.restore(id, reason(in)));
    }

    // ── Promo codes ──

    @GetMapping("/promotions")
    public ResponseEntity<ApiResponse<List<PromotionResponse>>> promotions() {
        return ok(promotions.list());
    }

    @PostMapping("/promotions")
    public ResponseEntity<ApiResponse<PromotionResponse>> createPromotion(@Valid @RequestBody PromotionInput in) {
        return created(promotions.create(in));
    }

    @PatchMapping("/promotions/{id}")
    public ResponseEntity<ApiResponse<PromotionResponse>> updatePromotion(@PathVariable UUID id,
            @Valid @RequestBody PromotionInput in) {
        return ok(promotions.update(id, in));
    }

    @PostMapping("/promotions/{id}/end")
    public ResponseEntity<ApiResponse<PromotionResponse>> endPromotion(@PathVariable UUID id) {
        return ok(promotions.end(id));
    }

    // ── Payouts ──

    @GetMapping("/payouts/balances")
    public ResponseEntity<ApiResponse<List<PayoutBalance>>> balances() {
        return ok(payouts.balances());
    }

    @GetMapping("/payouts")
    public ResponseEntity<ApiResponse<PageResponse<PayoutResponse>>> payoutHistory(
            @RequestParam(required = false) UUID businessId, @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ok(payouts.history(businessId, page, size));
    }

    @PostMapping("/payouts")
    public ResponseEntity<ApiResponse<PayoutResponse>> pay(@Valid @RequestBody PayoutInput in) {
        return created(payouts.pay(in));
    }

    // ── Settings and categories ──

    @GetMapping("/settings")
    public ResponseEntity<ApiResponse<PlatformSettingsResponse>> settings() {
        return ok(settings.get());
    }

    @PutMapping("/settings")
    public ResponseEntity<ApiResponse<PlatformSettingsResponse>> updateSettings(@Valid @RequestBody SettingsInput in) {
        return ok(settings.update(in));
    }

    @GetMapping("/categories")
    public ResponseEntity<ApiResponse<List<AdminCategoryRow>>> categories() {
        return ok(categories.list());
    }

    @PostMapping("/categories")
    public ResponseEntity<ApiResponse<AdminCategoryRow>> createCategory(@RequestBody CategoryInput in) {
        return created(categories.create(in));
    }

    @PatchMapping("/categories/{id}")
    public ResponseEntity<ApiResponse<AdminCategoryRow>> updateCategory(@PathVariable String id,
            @RequestBody CategoryInput in) {
        return ok(categories.update(id, in));
    }

    /** Body: every category id in the new display order. */
    @PutMapping("/categories/order")
    public ResponseEntity<ApiResponse<List<AdminCategoryRow>>> reorderCategories(@RequestBody List<String> ids) {
        return ok(categories.reorder(ids));
    }

    // ── Audit log ──

    @GetMapping("/audit")
    public ResponseEntity<ApiResponse<PageResponse<AuditEntry>>> audit(@RequestParam(required = false) String q,
            @RequestParam(required = false) String targetType, @RequestParam(required = false) String targetId,
            @RequestParam(required = false) String action, @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ok(audit.list(q, targetType, targetId, action, page, size));
    }

    private static String reason(ReasonInput in) {
        return in == null ? null : in.reason();
    }
}
