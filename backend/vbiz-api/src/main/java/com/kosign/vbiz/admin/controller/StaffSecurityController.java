package com.kosign.vbiz.admin.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.admin.payload.MfaCodeInput;
import com.kosign.vbiz.admin.payload.MfaSetupResponse;
import com.kosign.vbiz.admin.payload.MfaStatusResponse;
import com.kosign.vbiz.admin.payload.RecoveryCodesResponse;
import com.kosign.vbiz.admin.service.MfaService;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

/** The signed-in staff member's own sign-in security (docs/api/phase9-staff-security.md). */
@Tag(name = "Staff security")
@RestController
@RequestMapping("/api/staff/security")
@RequiredArgsConstructor
public class StaffSecurityController extends BaseController {

    private final MfaService mfa;

    @GetMapping
    public ResponseEntity<ApiResponse<MfaStatusResponse>> status() {
        return ok(mfa.status());
    }

    @PostMapping("/mfa/setup")
    public ResponseEntity<ApiResponse<MfaSetupResponse>> setup() {
        return ok(mfa.setup());
    }

    @PostMapping("/mfa/enable")
    public ResponseEntity<ApiResponse<RecoveryCodesResponse>> enable(@RequestBody MfaCodeInput in) {
        return ok(mfa.enable(in.code()));
    }

    @PostMapping("/mfa/verify")
    public ResponseEntity<ApiResponse<MfaStatusResponse>> verify(@RequestBody MfaCodeInput in) {
        return ok(mfa.verify(in));
    }

    @PostMapping("/mfa/recovery-codes")
    public ResponseEntity<ApiResponse<RecoveryCodesResponse>> recoveryCodes() {
        return ok(mfa.regenerate());
    }
}
