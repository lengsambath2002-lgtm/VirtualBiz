package com.kosign.vbiz.notification.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.api.EmptyJsonResponse;
import com.kosign.vbiz.common.security.CurrentUser;
import com.kosign.vbiz.notification.push.PushTokenInput;
import com.kosign.vbiz.notification.push.PushTokenService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** Turn push notifications on or off for this device (docs/ops/firebase.md). */
@Tag(name = "Notifications")
@RestController
@RequestMapping("/api/me/push-tokens")
@RequiredArgsConstructor
public class PushTokenController extends BaseController {

    private final PushTokenService tokens;

    @PostMapping
    public ResponseEntity<ApiResponse<EmptyJsonResponse>> register(@Valid @RequestBody PushTokenInput in) {
        tokens.register(CurrentUser.id(), in.token(), in.platform());
        return ok();
    }

    @DeleteMapping
    public ResponseEntity<ApiResponse<EmptyJsonResponse>> remove(@Valid @RequestBody PushTokenInput in) {
        tokens.remove(CurrentUser.id(), in.token());
        return ok();
    }
}
