package com.kosign.vbiz.platform.controller;

import java.time.Duration;
import java.util.Arrays;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import com.kosign.vbiz.auth.service.AuthProperties;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * {@code vb_platform}: binds a platform sign-in to the browser that started it (httpOnly,
 * {@code Path=/api/auth/platform}, {@code SameSite=Lax}, 30 minutes). Its hash is on the state and
 * link tickets, so a callback URL or link ticket sent to someone else's browser is refused.
 */
@Component
public class PlatformCookies {

    public static final String NAME = "vb_platform";
    public static final String PATH = "/api/auth/platform";
    static final Duration TTL = Duration.ofMinutes(30);

    private final AuthProperties props;

    public PlatformCookies(AuthProperties props) {
        this.props = props;
    }

    public String read(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        return cookies == null ? null
                : Arrays.stream(cookies).filter(c -> NAME.equals(c.getName())).map(Cookie::getValue).findFirst()
                        .orElse(null);
    }

    public void set(HttpServletResponse response, String value) {
        response.addHeader(HttpHeaders.SET_COOKIE, build(value, TTL).toString());
    }

    public void clear(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, build("", Duration.ZERO).toString());
    }

    private ResponseCookie build(String value, Duration maxAge) {
        return ResponseCookie.from(NAME, value).httpOnly(true).secure(props.cookieSecure()).sameSite("Lax").path(PATH)
                .maxAge(maxAge).build();
    }
}
