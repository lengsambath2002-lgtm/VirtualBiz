package com.kosign.vbiz.account.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.account.payload.ChangePasswordRequest;
import com.kosign.vbiz.account.payload.MeResponse;
import com.kosign.vbiz.account.payload.PrefsDto;
import com.kosign.vbiz.account.payload.UpdateMeRequest;
import com.kosign.vbiz.account.payload.UserResponse;
import com.kosign.vbiz.account.service.AccountService;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.api.EmptyJsonResponse;
import com.kosign.vbiz.common.security.CurrentUser;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Tag(name = "Account")
@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MeController extends BaseController {

    private final AccountService accounts;

    @GetMapping
    public ResponseEntity<ApiResponse<MeResponse>> me() {
        return ok(accounts.me(CurrentUser.id()));
    }

    @PatchMapping
    public ResponseEntity<ApiResponse<UserResponse>> update(@Valid @RequestBody UpdateMeRequest req) {
        return ok(accounts.update(CurrentUser.id(), req));
    }

    @PutMapping("/prefs")
    public ResponseEntity<ApiResponse<PrefsDto>> prefs(@Valid @RequestBody PrefsDto req) {
        return ok(accounts.updatePrefs(CurrentUser.id(), req));
    }

    @PostMapping("/password")
    public ResponseEntity<ApiResponse<EmptyJsonResponse>> password(@Valid @RequestBody ChangePasswordRequest req) {
        accounts.changePassword(CurrentUser.id(), req);
        return ok();
    }
}
