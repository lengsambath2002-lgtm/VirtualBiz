package com.kosign.vbiz.admin.service;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** {@code vbiz.staff.*}: staff sign-in security and invites (docs/api/phase9-staff-security.md). */
@ConfigurationProperties("vbiz.staff")
public record StaffProperties(
        @DefaultValue("false") boolean mfaRequired,
        @DefaultValue("PT12H") Duration mfaTtl,
        @DefaultValue("P7D") Duration inviteTtl,
        @DefaultValue("http://localhost:3000") String appUrl,
        @DefaultValue("false") boolean exposeDevLinks,
        @DefaultValue Bootstrap bootstrap) {

    public record Bootstrap(String email, @DefaultValue("VirtualBiz Admin") String name, String password) {
    }
}
