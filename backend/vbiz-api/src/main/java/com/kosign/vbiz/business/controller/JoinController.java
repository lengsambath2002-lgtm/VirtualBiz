package com.kosign.vbiz.business.controller;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.auth.controller.RefreshCookies;
import com.kosign.vbiz.auth.payload.AuthResult;
import com.kosign.vbiz.auth.payload.AuthSessionResponse;
import com.kosign.vbiz.auth.service.ClientInfo;
import com.kosign.vbiz.business.payload.JoinAcceptInput;
import com.kosign.vbiz.business.payload.JoinPreviewResponse;
import com.kosign.vbiz.business.service.TeamService;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** Public: open a shop team invite link and accept it (signs in). */
@Tag(name = "Team invites")
@RestController
@RequestMapping("/api/join")
@RequiredArgsConstructor
public class JoinController extends BaseController {

    private final TeamService team;
    private final RefreshCookies cookies;

    @GetMapping("/{token}")
    public ResponseEntity<ApiResponse<JoinPreviewResponse>> preview(@PathVariable String token) {
        return ok(team.preview(token));
    }

    @PostMapping("/{token}/accept")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> accept(@PathVariable String token,
            @Valid @RequestBody JoinAcceptInput in, HttpServletRequest http, HttpServletResponse res) {
        String forwarded = http.getHeader("X-Forwarded-For");
        String ip = forwarded != null && !forwarded.isBlank() ? forwarded.split(",")[0].trim() : http.getRemoteAddr();
        AuthResult r = team.accept(token, in, new ClientInfo(http.getHeader(HttpHeaders.USER_AGENT), ip));
        cookies.set(res, r.refreshToken());
        return ok(r.session());
    }
}
