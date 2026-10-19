package com.kosign.vbiz.common.api;

import java.time.Instant;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import com.kosign.vbiz.common.helper.HeaderContext;

/** Every controller extends this so all responses share the {@link ApiResponse} envelope. */
public abstract class BaseController {

    protected <T> ResponseEntity<ApiResponse<T>> ok(T data) {
        return build(StatusCode.SUCCESS, HttpStatus.OK, data);
    }

    protected ResponseEntity<ApiResponse<EmptyJsonResponse>> ok() {
        return build(StatusCode.SUCCESS, HttpStatus.OK, EmptyJsonResponse.INSTANCE);
    }

    /** HTTP 201 for POST create endpoints; the wire code is still SUCCESS. */
    protected <T> ResponseEntity<ApiResponse<T>> created(T data) {
        return build(StatusCode.SUCCESS, HttpStatus.CREATED, data);
    }

    private <T> ResponseEntity<ApiResponse<T>> build(StatusCode code, HttpStatus http, T data) {
        ApiResponse<T> body = new ApiResponse<>(
                ApiStatus.of(code),
                data,
                new ApiCommon(HeaderContext.getRequestId(), Instant.now()),
                null);
        return ResponseEntity.status(http).body(body);
    }
}
