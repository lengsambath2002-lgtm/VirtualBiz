package com.kosign.vbiz.common.api;

public record ApiStatus(String code, String message) {

    public static ApiStatus of(StatusCode statusCode) {
        return new ApiStatus(statusCode.getCode(), statusCode.getMessage());
    }

    public static ApiStatus of(StatusCode statusCode, String message) {
        return new ApiStatus(statusCode.getCode(), message);
    }
}
