package com.kosign.vbiz.common.error;

import java.time.Instant;
import java.util.List;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.kosign.vbiz.common.api.ApiCommon;
import com.kosign.vbiz.common.api.ApiError;
import com.kosign.vbiz.common.api.ApiErrorDetail;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.ApiStatus;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.helper.HeaderContext;

import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;

/**
 * Maps every exception to the {@link ApiResponse} envelope. Client mistakes log at warn,
 * server defects at error. Filter-level 401/403 are written by the security entry point and
 * access-denied handler; the handlers here cover the same failures thrown inside MVC.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Object>> handleBusiness(BusinessException ex) {
        String msg = ex.getMessage();
        List<ApiErrorDetail> details = ex.getDetails() != null
                ? ex.getDetails()
                : (msg == null || msg.isBlank())
                        ? List.of()
                        : List.of(new ApiErrorDetail(ex.getField(), msg, ex.getMeta()));
        log.warn("BusinessException: code={} field={} message={}", ex.getStatusCode(), ex.getField(), msg);
        return build(ex.getStatusCode(), details);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Object>> handleValidation(MethodArgumentNotValidException ex) {
        List<ApiErrorDetail> details = ex.getBindingResult().getFieldErrors().stream()
                .map(this::toDetail)
                .toList();
        return build(StatusCode.VALIDATION_FAILED, details);
    }

    /** Constraint violations on {@code @RequestParam} / {@code @PathVariable} of {@code @Validated} controllers. */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Object>> handleConstraintViolation(ConstraintViolationException ex) {
        List<ApiErrorDetail> details = ex.getConstraintViolations().stream()
                .map(v -> new ApiErrorDetail(lastNode(v.getPropertyPath().toString()), v.getMessage()))
                .toList();
        return build(StatusCode.VALIDATION_FAILED, details);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Object>> handleUnreadable(HttpMessageNotReadableException ex) {
        Throwable root = ex.getMostSpecificCause();
        String hint = root != null ? root.getMessage() : ex.getMessage();
        log.warn("HttpMessageNotReadable: {}", hint);
        return build(StatusCode.INVALID_REQUEST,
                hint == null || hint.isBlank() ? List.of() : List.of(new ApiErrorDetail(null, hint)));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Object>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        String expected = ex.getRequiredType() != null ? ex.getRequiredType().getSimpleName() : "(unknown)";
        String hint = String.format("Parameter '%s' could not be parsed as %s", ex.getName(), expected);
        log.warn("MethodArgumentTypeMismatch: {}", hint);
        return build(StatusCode.INVALID_REQUEST, List.of(new ApiErrorDetail(ex.getName(), hint)));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiResponse<Object>> handleMissingParam(MissingServletRequestParameterException ex) {
        String hint = String.format("Required parameter '%s' is missing", ex.getParameterName());
        log.warn("MissingServletRequestParameter: {}", hint);
        return build(StatusCode.INVALID_REQUEST, List.of(new ApiErrorDetail(ex.getParameterName(), hint)));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiResponse<Object>> handleMediaTypeNotSupported(HttpMediaTypeNotSupportedException ex) {
        String hint = String.format("Content-Type %s is not supported; expected %s",
                ex.getContentType() == null ? "(missing)" : ex.getContentType().toString(),
                ex.getSupportedMediaTypes());
        log.warn("HttpMediaTypeNotSupported: {}", hint);
        return build(StatusCode.INVALID_REQUEST, List.of(new ApiErrorDetail(null, hint)));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Object>> handleIllegalArgument(IllegalArgumentException ex) {
        String msg = ex.getMessage();
        log.warn("IllegalArgument: {}", msg);
        return build(StatusCode.INVALID_REQUEST,
                msg == null || msg.isBlank() ? List.of() : List.of(new ApiErrorDetail(null, msg)));
    }

    /** DB constraint the service did not guard. The DB message is logged, never returned. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Object>> handleDataIntegrity(DataIntegrityViolationException ex) {
        Throwable root = ex.getMostSpecificCause();
        log.error("[DB-CONSTRAINT] {}", root != null ? root.getMessage() : ex.getMessage());
        return build(StatusCode.CONFLICT, List.of());
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Object>> handleNoResourceFound(NoResourceFoundException ex) {
        log.warn("NoResourceFound: {} {}", ex.getHttpMethod(), ex.getResourcePath());
        return build(StatusCode.NOT_FOUND, List.of());
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Object>> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex) {
        String hint = String.format("Method %s is not allowed; supported: %s",
                ex.getMethod(), ex.getSupportedHttpMethods());
        log.warn("HttpRequestMethodNotSupported: {}", hint);
        return build(StatusCode.METHOD_NOT_ALLOWED, List.of(new ApiErrorDetail(null, hint)));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Object>> handleAccessDenied(AccessDeniedException ex) {
        log.warn("AccessDenied: {}", ex.getMessage());
        return build(StatusCode.FORBIDDEN, List.of());
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiResponse<Object>> handleAuthentication(AuthenticationException ex) {
        log.warn("Authentication: {}", ex.getMessage());
        return build(StatusCode.UNAUTHORIZED, List.of());
    }

    /** The client went away mid-response (navigated off, aborted fetch): nothing to answer. */
    @ExceptionHandler(AsyncRequestNotUsableException.class)
    public void handleClientGone(AsyncRequestNotUsableException ex) {
        log.debug("Client disconnected: {}", ex.getMessage());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Object>> handleUnexpected(Exception ex) {
        log.error("Unexpected error", ex);
        return build(StatusCode.INTERNAL_ERROR, List.of());
    }

    private ApiErrorDetail toDetail(FieldError fe) {
        return new ApiErrorDetail(fe.getField(), fe.getDefaultMessage());
    }

    /** Trims Spring's {@code methodName.paramName} property path down to {@code paramName}. */
    private String lastNode(String propertyPath) {
        int dot = propertyPath.lastIndexOf('.');
        return dot < 0 ? propertyPath : propertyPath.substring(dot + 1);
    }

    private ResponseEntity<ApiResponse<Object>> build(StatusCode code, List<ApiErrorDetail> details) {
        ApiResponse<Object> body = new ApiResponse<>(
                ApiStatus.of(code),
                null,
                new ApiCommon(HeaderContext.getRequestId(), Instant.now()),
                new ApiError(code.getErrorType(), details));
        return ResponseEntity.status(code.getHttpStatus()).body(body);
    }
}
