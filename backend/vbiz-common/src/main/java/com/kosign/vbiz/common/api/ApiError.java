package com.kosign.vbiz.common.api;

import java.util.List;

public record ApiError(ErrorType type, List<ApiErrorDetail> details) {

    public static ApiError of(ErrorType type) {
        return new ApiError(type, List.of());
    }

    public static ApiError of(ErrorType type, List<ApiErrorDetail> details) {
        return new ApiError(type, details == null ? List.of() : details);
    }
}
