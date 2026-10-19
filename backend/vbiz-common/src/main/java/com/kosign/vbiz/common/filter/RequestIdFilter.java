package com.kosign.vbiz.common.filter;

import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.kosign.vbiz.common.helper.HeaderContext;
import com.kosign.vbiz.common.tenancy.TenantContext;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Accepts the client's {@code X-Request-Id} (or makes one), echoes it back, exposes it in the
 * response envelope and the log MDC, and clears all per-request thread-locals at the end.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

    private static final Pattern SAFE_ID = Pattern.compile("^[A-Za-z0-9._-]{1,64}$");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String incoming = request.getHeader(HeaderContext.REQUEST_ID);
        String requestId = incoming != null && SAFE_ID.matcher(incoming).matches()
                ? incoming
                : UUID.randomUUID().toString();
        HeaderContext.setRequestId(requestId);
        MDC.put("requestId", requestId);
        response.setHeader(HeaderContext.REQUEST_ID, requestId);
        try {
            chain.doFilter(request, response);
        } finally {
            HeaderContext.clear();
            TenantContext.clear();
            MDC.remove("requestId");
        }
    }
}
