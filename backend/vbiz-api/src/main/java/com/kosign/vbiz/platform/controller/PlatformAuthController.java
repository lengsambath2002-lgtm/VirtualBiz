package com.kosign.vbiz.platform.controller;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.auth.controller.RefreshCookies;
import com.kosign.vbiz.auth.service.ClientInfo;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.security.CurrentUser;
import com.kosign.vbiz.platform.payload.PlatformCompleteRequest;
import com.kosign.vbiz.platform.payload.PlatformLinkRequest;
import com.kosign.vbiz.platform.payload.PlatformRoute;
import com.kosign.vbiz.platform.payload.PlatformSessionResponse;
import com.kosign.vbiz.platform.payload.PlatformStartRequest;
import com.kosign.vbiz.platform.payload.PlatformStartResponse;
import com.kosign.vbiz.platform.service.PlatformAuthService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** Sign-in with the Business Platform (docs/api/platform-sso.md). */
@Tag(name = "Auth")
@RestController
@RequestMapping("/api/auth/platform")
@RequiredArgsConstructor
public class PlatformAuthController extends BaseController {

    private final PlatformAuthService platform;
    private final PlatformCookies binding;
    private final RefreshCookies refresh;

    /** The platform's authorize URL for this sign-in; sets the browser binding cookie. */
    @PostMapping("/start")
    public ResponseEntity<ApiResponse<PlatformStartResponse>> start(@Valid @RequestBody PlatformStartRequest req,
            HttpServletResponse res) {
        PlatformAuthService.Started started = platform.start(req.intent(), req.businessId(), req.orgId(), req.next());
        binding.set(res, started.binding());
        return ok(new PlatformStartResponse(started.authorizeUrl()));
    }

    /** The callback page posts the code and state: a session plus where to go. */
    @PostMapping("/complete")
    public ResponseEntity<ApiResponse<PlatformSessionResponse>> complete(@Valid @RequestBody PlatformCompleteRequest req,
            HttpServletRequest http, HttpServletResponse res) {
        PlatformAuthService.Completed done = platform.complete(req.code(), req.state(), binding.read(http), client(http));
        refresh.set(res, done.auth().refreshToken());
        return ok(PlatformSessionResponse.of(done.auth().session(), done.route()));
    }

    /** Signed in as the account a LINK_REQUIRED answer named: link the platform account to it. */
    @PostMapping("/link")
    public ResponseEntity<ApiResponse<PlatformRoute>> link(@Valid @RequestBody PlatformLinkRequest req,
            HttpServletRequest http, HttpServletResponse res) {
        PlatformRoute route = platform.link(CurrentUser.id(), req.ticket(), binding.read(http));
        binding.clear(res);
        return ok(route);
    }

    private static ClientInfo client(HttpServletRequest http) {
        String forwarded = http.getHeader("X-Forwarded-For");
        String ip = forwarded != null && !forwarded.isBlank() ? forwarded.split(",")[0].trim() : http.getRemoteAddr();
        return new ClientInfo(http.getHeader(HttpHeaders.USER_AGENT), ip);
    }
}
