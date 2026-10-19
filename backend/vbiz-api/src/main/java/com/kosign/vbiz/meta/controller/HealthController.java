package com.kosign.vbiz.meta.controller;

import java.time.Instant;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.meta.payload.HealthResponse;

/** Liveness probe for load balancers and the clients' connectivity check. No auth, no DB. */
@RestController
@RequestMapping("/api")
public class HealthController extends BaseController {

    private final String version;

    public HealthController(@Value("${vbiz.version:dev}") String version) {
        this.version = version;
    }

    @GetMapping("/health")
    public ResponseEntity<ApiResponse<HealthResponse>> health() {
        return ok(new HealthResponse("UP", version, Instant.now()));
    }
}
