package com.kosign.vbiz.common.api;

import java.util.Map;

public record ApiErrorDetail(String field, String message, Map<String, Object> meta) {

    public ApiErrorDetail(String field, String message) {
        this(field, message, null);
    }
}
