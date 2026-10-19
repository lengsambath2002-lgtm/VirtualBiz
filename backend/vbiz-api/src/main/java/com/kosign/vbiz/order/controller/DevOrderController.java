package com.kosign.vbiz.order.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.order.payload.OrderInputs;
import com.kosign.vbiz.order.payload.OrderResponse;
import com.kosign.vbiz.order.scheduler.OrderJobs;
import com.kosign.vbiz.order.service.OrderProperties;
import com.kosign.vbiz.order.service.OrderService;

import io.swagger.v3.oas.annotations.Hidden;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * LOCAL / TEST ONLY hooks for end-to-end tests ({@code vbiz.orders.dev-endpoints}; {@code NOT_FOUND}
 * otherwise): age an order and run the order jobs now. Any signed-in user may call them locally.
 */
@Hidden
@RestController
@RequestMapping("/api/dev")
@RequiredArgsConstructor
public class DevOrderController extends BaseController {

    private final OrderService orders;
    private final OrderJobs jobs;
    private final OrderProperties props;
    private final java.time.Clock clock;

    @PostMapping("/orders/{ref}/age")
    public ResponseEntity<ApiResponse<OrderResponse>> age(@PathVariable String ref,
            @Valid @RequestBody OrderInputs.Age in) {
        requireEnabled();
        return ok(orders.age(ref, in.minutes()));
    }

    @PostMapping("/jobs/orders")
    public ResponseEntity<ApiResponse<OrderJobs.Run>> runJobs() {
        requireEnabled();
        return ok(jobs.run(clock.instant()));
    }

    private void requireEnabled() {
        if (!props.devEndpoints()) {
            throw new BusinessException(StatusCode.NOT_FOUND);
        }
    }
}
