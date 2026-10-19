package com.kosign.vbiz.order.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.security.AuthPrincipal;
import com.kosign.vbiz.common.security.CurrentUser;
import com.kosign.vbiz.order.payload.CheckoutInput;
import com.kosign.vbiz.order.payload.CheckoutResultResponse;
import com.kosign.vbiz.order.payload.QuoteResponse;
import com.kosign.vbiz.order.service.CheckoutService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** Quote (public) and place (signed in) a checkout (docs/api/phase3-orders-checkout.md § Checkout). */
@Tag(name = "Checkout")
@RestController
@RequestMapping("/api/checkout")
@RequiredArgsConstructor
public class CheckoutController extends BaseController {

    private final CheckoutService checkout;

    @PostMapping("/quote")
    public ResponseEntity<ApiResponse<QuoteResponse>> quote(@Valid @RequestBody CheckoutInput in) {
        return ok(checkout.quote(CurrentUser.principal().map(AuthPrincipal::userId).orElse(null), in));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CheckoutResultResponse>> place(
            @RequestHeader(name = "Idempotency-Key", required = false) String key,
            @Valid @RequestBody CheckoutInput in) {
        return created(checkout.place(CurrentUser.id(), key, in));
    }
}
