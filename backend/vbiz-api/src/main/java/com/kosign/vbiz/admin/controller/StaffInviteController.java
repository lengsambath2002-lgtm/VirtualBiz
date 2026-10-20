package com.kosign.vbiz.admin.controller;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.admin.payload.InviteAcceptInput;
import com.kosign.vbiz.admin.payload.InvitePreviewResponse;
import com.kosign.vbiz.admin.service.StaffInviteService;
import com.kosign.vbiz.auth.controller.RefreshCookies;
import com.kosign.vbiz.auth.payload.AuthResult;
import com.kosign.vbiz.auth.payload.AuthSessionResponse;
import com.kosign.vbiz.auth.service.ClientInfo;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** Public: open a staff invite link and accept it (signs in). */
@Tag(name = "Staff invites")
@RestController
@RequestMapping("/api/staff-invites")
@RequiredArgsConstructor
public class StaffInviteController extends BaseController {

    private final StaffInviteService invites;
    private final RefreshCookies cookies;

    @GetMapping("/{token}")
    public ResponseEntity<ApiResponse<InvitePreviewResponse>> preview(@PathVariable String token) {
        return ok(invites.preview(token));
    }

    @PostMapping("/{token}/accept")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> accept(@PathVariable String token,
            @Valid @RequestBody InviteAcceptInput in, HttpServletRequest http, HttpServletResponse res) {
        String forwarded = http.getHeader("X-Forwarded-For");
        String ip = forwarded != null && !forwarded.isBlank() ? forwarded.split(",")[0].trim() : http.getRemoteAddr();
        AuthResult r = invites.accept(token, in, new ClientInfo(http.getHeader(HttpHeaders.USER_AGENT), ip));
        cookies.set(res, r.refreshToken());
        return ok(r.session());
    }
}
