package com.kosign.vbiz.order.controller;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.payment.domain.PaymentMethod;
import com.kosign.vbiz.order.domain.OrderSource;
import com.kosign.vbiz.order.domain.FulfilmentMethod;
import com.kosign.vbiz.common.list.PageResponse;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.order.payload.BulkResultResponse;
import com.kosign.vbiz.order.payload.OrderCountsResponse;
import com.kosign.vbiz.order.payload.OrderInputs;
import com.kosign.vbiz.order.payload.OrderResponse;
import com.kosign.vbiz.order.service.ManualOrderService;
import com.kosign.vbiz.order.service.OrderService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** The seller's order flow (docs/api/phase3-orders-checkout.md § Seller). Needs X-Business-Id. */
@Tag(name = "Orders")
@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class SellerOrderController extends BaseController {

    private final OrderService orders;
    private final ManualOrderService manual;

    /** An order the shop took by phone, Facebook, Telegram or at the counter (docs/api/phase8-manual-orders.md). */
    @PostMapping("/manual")
    public ResponseEntity<ApiResponse<OrderResponse>> manual(@Valid @RequestBody OrderInputs.Manual in) {
        return created(manual.create(in));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<OrderResponse>>> list(@RequestParam(required = false) String tab,
            @RequestParam(required = false) String q, @RequestParam(required = false) Integer limit) {
        return ok(orders.shopOrders(tab, q, limit));
    }

    /** Every order of the shop, a page at a time (the history; the open tabs use {@code GET /orders}). */
    @GetMapping("/history")
    public ResponseEntity<ApiResponse<PageResponse<OrderResponse>>> history(
            @RequestParam(required = false) String tab, @RequestParam(required = false) String q,
            @RequestParam(required = false) FulfilmentMethod method, @RequestParam(required = false) PaymentMethod pay,
            @RequestParam(required = false) OrderSource source,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String sort, @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ok(orders.shopOrderHistory(tab, q, method, pay, source, from, to, sort, page, size));
    }

    @GetMapping("/counts")
    public ResponseEntity<ApiResponse<OrderCountsResponse>> counts() {
        return ok(orders.counts());
    }

    @GetMapping("/{ref}")
    public ResponseEntity<ApiResponse<OrderResponse>> get(@PathVariable String ref) {
        return ok(orders.shopOrder(ref));
    }

    @PostMapping("/accept")
    public ResponseEntity<ApiResponse<BulkResultResponse>> accept(@Valid @RequestBody OrderInputs.Ids in) {
        return ok(orders.accept(in.ids()));
    }

    @PostMapping("/accept/undo")
    public ResponseEntity<ApiResponse<BulkResultResponse>> undoAccept(@Valid @RequestBody OrderInputs.Ids in) {
        return ok(orders.undoAccept(in.ids()));
    }

    @PostMapping("/bulk")
    public ResponseEntity<ApiResponse<BulkResultResponse>> bulk(@Valid @RequestBody OrderInputs.Bulk in) {
        return ok(orders.bulk(in.action(), in.ids()));
    }

    @PostMapping("/{ref}/reject")
    public ResponseEntity<ApiResponse<OrderResponse>> reject(@PathVariable String ref,
            @Valid @RequestBody OrderInputs.Reject in) {
        return ok(orders.reject(ref, in.reason(), Boolean.TRUE.equals(in.markSoldOut())));
    }

    @PostMapping("/{ref}/pack")
    public ResponseEntity<ApiResponse<OrderResponse>> pack(@PathVariable String ref) {
        return ok(orders.pack(ref));
    }

    @PostMapping("/{ref}/ship")
    public ResponseEntity<ApiResponse<OrderResponse>> ship(@PathVariable String ref,
            @Valid @RequestBody OrderInputs.Ship in) {
        return ok(orders.ship(ref, in.deliveryBy()));
    }

    @PostMapping("/{ref}/pickup")
    public ResponseEntity<ApiResponse<OrderResponse>> pickup(@PathVariable String ref) {
        return ok(orders.pickup(ref));
    }

    @PostMapping("/{ref}/deliver")
    public ResponseEntity<ApiResponse<OrderResponse>> deliver(@PathVariable String ref) {
        return ok(orders.deliver(ref));
    }

    @PostMapping("/{ref}/fail")
    public ResponseEntity<ApiResponse<OrderResponse>> fail(@PathVariable String ref,
            @Valid @RequestBody OrderInputs.Fail in) {
        return ok(orders.fail(ref, in.reason()));
    }

    @PostMapping("/{ref}/return")
    public ResponseEntity<ApiResponse<OrderResponse>> giveBack(@PathVariable String ref,
            @Valid @RequestBody OrderInputs.Return in) {
        return ok(orders.giveBack(ref, in.reason(), Boolean.TRUE.equals(in.restock())));
    }
}
