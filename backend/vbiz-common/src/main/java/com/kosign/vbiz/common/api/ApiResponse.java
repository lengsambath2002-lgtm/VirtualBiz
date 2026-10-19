package com.kosign.vbiz.common.api;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * The single response envelope for every endpoint: {@code {status, data, common, error}}.
 * {@code status.code} is a {@link StatusCode} name; the client translates it.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(ApiStatus status, T data, ApiCommon common, ApiError error) {
}
