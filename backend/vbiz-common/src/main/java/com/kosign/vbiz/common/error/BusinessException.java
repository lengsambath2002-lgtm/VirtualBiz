package com.kosign.vbiz.common.error;

import java.util.List;
import java.util.Map;

import com.kosign.vbiz.common.api.ApiErrorDetail;

import com.kosign.vbiz.common.api.StatusCode;

import lombok.Getter;

/** A typed, expected failure. {@link GlobalExceptionHandler} maps it to the envelope. */
@Getter
public class BusinessException extends RuntimeException {

    private final StatusCode statusCode;

    /** Optional field path the error is about, surfaced as {@code error.details[].field}. */
    private final String field;

    /** Optional structured data the client can act on, surfaced as {@code error.details[].meta}. */
    private final Map<String, Object> meta;

    /** Several problems at once (e.g. one per short checkout line); null = the single detail above. */
    private final List<ApiErrorDetail> details;

    public BusinessException(StatusCode statusCode, Object... args) {
        super(statusCode.formatMessage(args));
        this.statusCode = statusCode;
        this.field = null;
        this.meta = null;
        this.details = null;
    }

    public BusinessException(StatusCode statusCode, Throwable cause, Object... args) {
        super(statusCode.formatMessage(args), cause);
        this.statusCode = statusCode;
        this.field = null;
        this.meta = null;
        this.details = null;
    }

    private BusinessException(StatusCode statusCode, String field, String detail, Map<String, Object> meta) {
        super(detail);
        this.statusCode = statusCode;
        this.field = field;
        this.meta = meta;
        this.details = null;
    }

    private BusinessException(StatusCode statusCode, List<ApiErrorDetail> details) {
        super(details.isEmpty() ? statusCode.getMessage() : details.get(0).message());
        this.statusCode = statusCode;
        this.field = details.isEmpty() ? null : details.get(0).field();
        this.meta = details.isEmpty() ? null : details.get(0).meta();
        this.details = List.copyOf(details);
    }

    /** One error code with several details (each with its own field and meta). */
    public static BusinessException withDetails(StatusCode statusCode, List<ApiErrorDetail> details) {
        return new BusinessException(statusCode, details);
    }

    public static BusinessException withDetail(StatusCode statusCode, String field, String detail) {
        return new BusinessException(statusCode, field, detail, null);
    }

    public static BusinessException withDetail(
            StatusCode statusCode, String field, String detail, Map<String, Object> meta) {
        return new BusinessException(statusCode, field, detail, meta);
    }
}
