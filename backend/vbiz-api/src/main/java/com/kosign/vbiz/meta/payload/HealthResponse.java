package com.kosign.vbiz.meta.payload;

import java.time.Instant;

public record HealthResponse(String status, String version, Instant time) {
}
