package com.kosign.vbiz.platform.payload;

import java.util.List;

import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.domain.MemberRole;
import com.kosign.vbiz.platform.domain.PlatformOrg;

/**
 * Where the web app goes after a platform sign-in: the {@code intent} it was started with, the
 * shop ({@code businessId}, and {@code business} when the person can open it), the organisation
 * asked for ({@code orgId}), {@code next} for a plain sign-in, and the person's organisations
 * from the ID token ({@code orgs}, for choosing one to connect a shop to).
 */
public record PlatformRoute(String intent, String businessId, String orgId, String next, List<PlatformOrg> orgs,
        RouteBusiness business) {

    /** The shop to open and the person's role in it. */
    public record RouteBusiness(String id, String name, BusinessType type, MemberRole role) {
    }
}
