package com.kosign.vbiz.platform.controller;

import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.security.CurrentUser;
import com.kosign.vbiz.platform.payload.PlatformConnectRequest;
import com.kosign.vbiz.platform.payload.PlatformShopLinkResponse;
import com.kosign.vbiz.platform.service.PlatformShopService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** A shop's link to a Business Platform organisation (docs/api/platform-sso.md). */
@Tag(name = "Business")
@RestController
@RequestMapping("/api/businesses/{id}/platform")
@RequiredArgsConstructor
public class PlatformShopController extends BaseController {

    private final PlatformShopService shops;

    @GetMapping
    public ResponseEntity<ApiResponse<PlatformShopLinkResponse>> status(@PathVariable UUID id) {
        return ok(shops.status(CurrentUser.id(), id));
    }

    @PostMapping("/connect")
    public ResponseEntity<ApiResponse<PlatformShopLinkResponse>> connect(@PathVariable UUID id,
            @Valid @RequestBody PlatformConnectRequest req) {
        return ok(shops.connect(CurrentUser.id(), id, req.orgId()));
    }

    @DeleteMapping("/connect")
    public ResponseEntity<ApiResponse<PlatformShopLinkResponse>> disconnect(@PathVariable UUID id) {
        return ok(shops.disconnect(CurrentUser.id(), id));
    }
}
