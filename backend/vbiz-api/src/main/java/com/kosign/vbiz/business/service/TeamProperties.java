package com.kosign.vbiz.business.service;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** {@code vbiz.team.*}: shop team invites (docs/api/phase10-shop-team.md). */
@ConfigurationProperties("vbiz.team")
public record TeamProperties(
        @DefaultValue("P7D") Duration inviteTtl,
        @DefaultValue("http://localhost:3000") String appUrl,
        @DefaultValue("false") boolean exposeDevLinks) {
}
