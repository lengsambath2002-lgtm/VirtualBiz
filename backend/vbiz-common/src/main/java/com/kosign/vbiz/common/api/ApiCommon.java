package com.kosign.vbiz.common.api;

import java.time.Instant;

public record ApiCommon(String requestId, Instant timestamp) {
}
