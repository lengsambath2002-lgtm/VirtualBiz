package com.kosign.vbiz.auth.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.admin.payload.MfaSetupResponse;
import com.kosign.vbiz.admin.payload.RecoveryCodesResponse;
import com.kosign.vbiz.auth.payload.TwoStepCodeRequest;
import com.kosign.vbiz.auth.payload.TwoStepStatusResponse;
import com.kosign.vbiz.auth.service.TwoStepService;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** The signed-in person's two-step sign-in (docs/api/two-step.md). */
@Tag(name = "Two-step sign-in")
@RestController
@RequestMapping("/api/me/two-step")
@RequiredArgsConstructor
public class TwoStepController extends BaseController {

    private final TwoStepService twoStep;

    @GetMapping
    public ResponseEntity<ApiResponse<TwoStepStatusResponse>> status() {
        return ok(twoStep.status());
    }

    @PostMapping("/setup")
    public ResponseEntity<ApiResponse<MfaSetupResponse>> setup() {
        return ok(twoStep.setup());
    }

    @PostMapping("/enable")
    public ResponseEntity<ApiResponse<RecoveryCodesResponse>> enable(@Valid @RequestBody TwoStepCodeRequest in) {
        return ok(twoStep.enable(in.code()));
    }

    @PostMapping("/disable")
    public ResponseEntity<ApiResponse<TwoStepStatusResponse>> disable(@Valid @RequestBody TwoStepCodeRequest in) {
        return ok(twoStep.disable(in));
    }

    @PostMapping("/recovery-codes")
    public ResponseEntity<ApiResponse<RecoveryCodesResponse>> recoveryCodes(
            @Valid @RequestBody TwoStepCodeRequest in) {
        return ok(twoStep.regenerate(in));
    }
}
