package com.kosign.vbiz.storage.service;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * {@code vbiz.storage.*}: where uploads are kept ({@code type}: {@code local} disk under {@code dir},
 * or {@code db} for a host whose disk doesn't last) and how big one may be.
 */
@ConfigurationProperties("vbiz.storage")
public record StorageProperties(
        @DefaultValue("local") String type,
        @DefaultValue("./data/uploads") String dir,
        @DefaultValue("8388608") long maxBytes) {
}
