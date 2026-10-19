package com.kosign.vbiz.common.tenancy;

import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

import org.springframework.web.filter.OncePerRequestFilter;

import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.security.ApiErrorWriter;
import com.kosign.vbiz.common.security.AuthPrincipal;
import com.kosign.vbiz.common.security.CurrentUser;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Reads {@code X-Business-Id} on authenticated requests, checks the user is a member and sets
 * {@link TenantContext} for the rest of the request. A malformed id or a non-member gets
 * {@code FORBIDDEN_TENANT}. Runs after the JWT filter; anonymous requests pass through.
 */
public class TenancyFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Business-Id";

    private final TenantMembershipChecker checker;
    private final ApiErrorWriter writer;

    public TenancyFilter(TenantMembershipChecker checker, ApiErrorWriter writer) {
        this.checker = checker;
        this.writer = writer;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String raw = request.getHeader(HEADER);
        Optional<AuthPrincipal> principal = CurrentUser.principal();
        if (raw == null || raw.isBlank() || principal.isEmpty()) {
            chain.doFilter(request, response);
            return;
        }
        UUID businessId;
        try {
            businessId = UUID.fromString(raw.trim());
        } catch (IllegalArgumentException ex) {
            writer.write(response, StatusCode.FORBIDDEN_TENANT);
            return;
        }
        if (!checker.isMember(principal.get().userId(), businessId)) {
            writer.write(response, StatusCode.FORBIDDEN_TENANT);
            return;
        }
        TenantContext.set(businessId);
        try {
            chain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }
}
