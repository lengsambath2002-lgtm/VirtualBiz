package com.kosign.vbiz.cart.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.cart.payload.CartInput;
import com.kosign.vbiz.cart.payload.CartResponse;
import com.kosign.vbiz.cart.service.CartService;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.security.CurrentUser;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** The signed-in customer's cart (docs/api/phase3-orders-checkout.md § Cart). */
@Tag(name = "Cart")
@RestController
@RequestMapping("/api/me/cart")
@RequiredArgsConstructor
public class CartController extends BaseController {

    private final CartService cart;

    @GetMapping
    public ResponseEntity<ApiResponse<CartResponse>> get() {
        return ok(cart.get(CurrentUser.id()));
    }

    @PutMapping
    public ResponseEntity<ApiResponse<CartResponse>> replace(@Valid @RequestBody CartInput in) {
        return ok(cart.replace(CurrentUser.id(), in));
    }

    @PostMapping("/merge")
    public ResponseEntity<ApiResponse<CartResponse>> merge(@Valid @RequestBody CartInput in) {
        return ok(cart.merge(CurrentUser.id(), in));
    }
}
