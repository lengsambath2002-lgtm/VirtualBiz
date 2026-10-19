package com.kosign.vbiz.admin.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.admin.payload.ShopPayoutsResponse;
import com.kosign.vbiz.admin.service.ShopPayoutService;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

/** The shop's balance with VirtualBiz and its payouts (docs/api/phase7-admin.md § Payouts). Needs X-Business-Id. */
@Tag(name = "Payouts")
@RestController
@RequestMapping("/api/payouts")
@RequiredArgsConstructor
public class ShopPayoutController extends BaseController {

    private final ShopPayoutService payouts;

    @GetMapping
    public ResponseEntity<ApiResponse<ShopPayoutsResponse>> mine() {
        return ok(payouts.mine());
    }
}
