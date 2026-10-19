package com.kosign.vbiz.order.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.security.CurrentUser;
import com.kosign.vbiz.order.payload.OrderInputs;
import com.kosign.vbiz.order.payload.OrderResponse;
import com.kosign.vbiz.order.service.OrderService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** The customer's orders: list, tracking, cancel (docs/api/phase3-orders-checkout.md § Customer). */
@Tag(name = "Orders")
@RestController
@RequestMapping("/api/me/orders")
@RequiredArgsConstructor
public class MyOrderController extends BaseController {

    private final OrderService orders;

    @GetMapping
    public ResponseEntity<ApiResponse<List<OrderResponse>>> list(@RequestParam(required = false) String bucket,
            @RequestParam(required = false) String q) {
        return ok(orders.myOrders(CurrentUser.id(), bucket, q));
    }

    @GetMapping("/{ref}")
    public ResponseEntity<ApiResponse<OrderResponse>> get(@PathVariable String ref) {
        return ok(orders.myOrder(CurrentUser.id(), ref));
    }

    @PostMapping("/{ref}/cancel")
    public ResponseEntity<ApiResponse<OrderResponse>> cancel(@PathVariable String ref,
            @Valid @RequestBody OrderInputs.CustomerCancel in) {
        return ok(orders.cancelMine(CurrentUser.id(), ref, in.reason()));
    }
}
