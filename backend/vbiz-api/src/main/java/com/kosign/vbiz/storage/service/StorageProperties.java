package com.kosign.vbiz.storage.service;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** {@code vbiz.storage.*}: where uploads are kept and how big one may be. */
@ConfigurationProperties("vbiz.storage")
public record StorageProperties(
        @DefaultValue("./data/uploads") String dir,
        @DefaultValue("8388608") long maxBytes) {
}
