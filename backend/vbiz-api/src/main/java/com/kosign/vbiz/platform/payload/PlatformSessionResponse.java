package com.kosign.vbiz.platform.payload;

import java.util.List;

import com.kosign.vbiz.account.payload.UserResponse;
import com.kosign.vbiz.auth.payload.AuthSessionResponse;
import com.kosign.vbiz.platform.domain.PlatformOrg;

/** The usual sign-in session ({@code accessToken}, {@code expiresIn}, {@code user}) plus the {@link PlatformRoute}. */
public record PlatformSessionResponse(String accessToken, long expiresIn, UserResponse user, String intent,
        String businessId, String orgId, String next, List<PlatformOrg> orgs, PlatformRoute.RouteBusiness business) {

    public static PlatformSessionResponse of(AuthSessionResponse s, PlatformRoute r) {
        return new PlatformSessionResponse(s.accessToken(), s.expiresIn(), s.user(), r.intent(), r.businessId(),
                r.orgId(), r.next(), r.orgs(), r.business());
    }
}
