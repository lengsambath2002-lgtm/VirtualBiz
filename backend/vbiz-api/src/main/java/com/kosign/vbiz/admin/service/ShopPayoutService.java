package com.kosign.vbiz.admin.service;

import java.time.Clock;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.admin.payload.ShopPayoutsResponse;
import com.kosign.vbiz.admin.repository.AdminQueries;
import com.kosign.vbiz.business.service.WorkspaceAccess;
import com.kosign.vbiz.meta.service.PlatformSettingsService;

import lombok.RequiredArgsConstructor;

/** A shop's own payouts (owner and managers; needs {@code X-Business-Id}). */
@Service
@RequiredArgsConstructor
public class ShopPayoutService {

    private final WorkspaceAccess access;
    private final AdminQueries queries;
    private final PlatformSettingsService settings;
    private final Clock clock;

    @Transactional(readOnly = true)
    public ShopPayoutsResponse mine() {
        var w = access.manager();
        return new ShopPayoutsResponse(
                queries.balance(w.businessId(), clock.instant().minus(settings.payoutDelay())).orElse(null),
                queries.payouts(w.businessId(), 0, 10).items(),
                (int) settings.payoutDelay().toDays(), settings.commissionPct());
    }
}
