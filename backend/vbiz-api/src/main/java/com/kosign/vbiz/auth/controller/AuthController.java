package com.kosign.vbiz.auth.controller;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.auth.payload.AuthResult;
import com.kosign.vbiz.auth.payload.AuthSessionResponse;
import com.kosign.vbiz.auth.payload.EmailCodeRequest;
import com.kosign.vbiz.auth.payload.GoogleDevRequest;
import com.kosign.vbiz.auth.payload.FirebaseSignInRequest;
import com.kosign.vbiz.auth.payload.GoogleRequest;
import com.kosign.vbiz.auth.payload.LoginRequest;
import com.kosign.vbiz.auth.payload.LookupRequest;
import com.kosign.vbiz.auth.payload.LookupResponse;
import com.kosign.vbiz.auth.payload.OtpRequest;
import com.kosign.vbiz.auth.payload.OtpSentResponse;
import com.kosign.vbiz.auth.payload.PhoneRegisterRequest;
import com.kosign.vbiz.auth.payload.PhoneVerifyRequest;
import com.kosign.vbiz.auth.payload.PhoneVerifyResponse;
import com.kosign.vbiz.auth.payload.PhoneVerifyResult;
import com.kosign.vbiz.auth.payload.ResetPasswordRequest;
import com.kosign.vbiz.auth.payload.ResetTokenResponse;
import com.kosign.vbiz.auth.payload.SignInMethodsResponse;
import com.kosign.vbiz.auth.payload.SignupRequest;
import com.kosign.vbiz.auth.service.AuthService;
import com.kosign.vbiz.auth.service.ClientInfo;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.api.EmptyJsonResponse;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.security.CurrentUser;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** Sign-in endpoints (docs/api/phase1-auth-account-business.md § Auth). */
@Tag(name = "Auth")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController extends BaseController {

    private final AuthService auth;
    private final RefreshCookies cookies;

    /** Which ways in this server can deliver (phone needs an SMS provider). */
    @GetMapping("/methods")
    public ResponseEntity<ApiResponse<SignInMethodsResponse>> methods() {
        return ok(new SignInMethodsResponse(auth.phoneAvailable()));
    }

    @PostMapping("/lookup")
    public ResponseEntity<ApiResponse<LookupResponse>> lookup(@Valid @RequestBody LookupRequest req) {
        return ok(auth.lookup(req.email()));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> login(
            @Valid @RequestBody LoginRequest req, HttpServletRequest http, HttpServletResponse res) {
        return session(auth.login(req.email(), req.password(), client(http)), res);
    }

    @PostMapping("/otp")
    public ResponseEntity<ApiResponse<OtpSentResponse>> otp(@Valid @RequestBody OtpRequest req) {
        return ok(auth.sendOtp(req.purpose(), req.to()));
    }

    @PostMapping("/signup")
    public ResponseEntity<ApiResponse<OtpSentResponse>> signup(@Valid @RequestBody SignupRequest req) {
        return ok(auth.signup(req.name(), req.email(), req.password()));
    }

    @PostMapping("/signup/verify")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> verifySignup(
            @Valid @RequestBody EmailCodeRequest req, HttpServletRequest http, HttpServletResponse res) {
        return session(auth.verifySignup(req.email(), req.code(), client(http)), res);
    }

    @PostMapping("/login/code")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> loginWithCode(
            @Valid @RequestBody EmailCodeRequest req, HttpServletRequest http, HttpServletResponse res) {
        return session(auth.loginWithCode(req.email(), req.code(), client(http)), res);
    }

    @PostMapping("/password/reset/verify")
    public ResponseEntity<ApiResponse<ResetTokenResponse>> verifyReset(@Valid @RequestBody EmailCodeRequest req) {
        return ok(auth.verifyReset(req.email(), req.code()));
    }

    @PostMapping("/password/reset")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest req, HttpServletRequest http, HttpServletResponse res) {
        return session(auth.resetPassword(req.resetToken(), req.password(), client(http)), res);
    }

    @PostMapping("/phone/verify")
    public ResponseEntity<ApiResponse<PhoneVerifyResponse>> verifyPhone(
            @Valid @RequestBody PhoneVerifyRequest req, HttpServletRequest http, HttpServletResponse res) {
        PhoneVerifyResult result = auth.verifyPhone(req.phone(), req.code(), client(http));
        if (result.refreshToken() != null) {
            cookies.set(res, result.refreshToken());
        }
        return ok(result.body());
    }

    @PostMapping("/phone/register")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> registerPhone(
            @Valid @RequestBody PhoneRegisterRequest req, HttpServletRequest http, HttpServletResponse res) {
        return session(auth.registerPhone(req.phoneToken(), req.name(), req.email(), client(http)), res);
    }

    @PostMapping("/google")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> google(
            @Valid @RequestBody GoogleRequest req, HttpServletRequest http, HttpServletResponse res) {
        return session(auth.google(req.idToken(), client(http)), res);
    }

    /** A Firebase sign-in (Google, or email + password) becomes a VirtualBiz session (docs/ops/firebase.md). */
    @PostMapping("/firebase")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> firebase(
            @Valid @RequestBody FirebaseSignInRequest req, HttpServletRequest http, HttpServletResponse res) {
        return session(auth.firebase(req.idToken(), req.name(), client(http)), res);
    }

    /** First Firebase sign-in of an account whose password VirtualBiz keeps: its Firebase account gets it. */
    @PostMapping("/firebase/migrate")
    public ResponseEntity<ApiResponse<EmptyJsonResponse>> firebaseMigrate(@Valid @RequestBody LoginRequest req) {
        auth.firebaseMigrate(req.email(), req.password());
        return ok();
    }

    @PostMapping("/google/dev")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> googleDev(
            @Valid @RequestBody GoogleDevRequest req, HttpServletRequest http, HttpServletResponse res) {
        return session(auth.googleDev(req.email(), req.name(), client(http)), res);
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthSessionResponse>> refresh(HttpServletRequest http, HttpServletResponse res) {
        try {
            return session(auth.refresh(cookies.read(http), client(http)), res);
        } catch (BusinessException ex) {
            cookies.clear(res);
            throw ex;
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<EmptyJsonResponse>> logout(HttpServletRequest http, HttpServletResponse res) {
        auth.logout(cookies.read(http));
        cookies.clear(res);
        return ok();
    }

    @PostMapping("/logout-all")
    public ResponseEntity<ApiResponse<EmptyJsonResponse>> logoutAll(HttpServletResponse res) {
        auth.logoutAll(CurrentUser.id());
        cookies.clear(res);
        return ok();
    }

    private ResponseEntity<ApiResponse<AuthSessionResponse>> session(AuthResult result, HttpServletResponse res) {
        cookies.set(res, result.refreshToken());
        return ok(result.session());
    }

    private static ClientInfo client(HttpServletRequest http) {
        String forwarded = http.getHeader("X-Forwarded-For");
        String ip = forwarded != null && !forwarded.isBlank() ? forwarded.split(",")[0].trim() : http.getRemoteAddr();
        return new ClientInfo(http.getHeader(HttpHeaders.USER_AGENT), ip);
    }
}
