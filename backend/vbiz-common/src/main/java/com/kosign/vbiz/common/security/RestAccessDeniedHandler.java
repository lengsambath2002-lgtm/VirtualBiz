package com.kosign.vbiz.common.security;

import java.io.IOException;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import com.kosign.vbiz.common.api.StatusCode;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/** 403 {@code FORBIDDEN} in the envelope. */
@Component
public class RestAccessDeniedHandler implements AccessDeniedHandler {

    private final ApiErrorWriter writer;

    public RestAccessDeniedHandler(ApiErrorWriter writer) {
        this.writer = writer;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException ex)
            throws IOException {
        writer.write(response, StatusCode.FORBIDDEN);
    }
}
