package com.kosign.vbiz.common.security;

import java.io.IOException;
import java.time.Instant;
import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kosign.vbiz.common.api.ApiCommon;
import com.kosign.vbiz.common.api.ApiError;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.ApiStatus;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.helper.HeaderContext;

import jakarta.servlet.http.HttpServletResponse;

/** Writes the {@link ApiResponse} error envelope from filters, outside Spring MVC. */
@Component
public class ApiErrorWriter {

    private final ObjectMapper objectMapper;

    public ApiErrorWriter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void write(HttpServletResponse response, StatusCode code) throws IOException {
        if (response.isCommitted()) {
            return;
        }
        ApiResponse<Object> body = new ApiResponse<>(
                ApiStatus.of(code),
                null,
                new ApiCommon(HeaderContext.getRequestId(), Instant.now()),
                new ApiError(code.getErrorType(), List.of()));
        response.setStatus(code.getHttpStatus().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getOutputStream(), body);
    }
}
