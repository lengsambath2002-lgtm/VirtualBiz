package com.kosign.vbiz.payment.controller;

import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.security.CurrentUser;
import com.kosign.vbiz.payment.payload.PaymentIntentResponse;
import com.kosign.vbiz.payment.service.PaymentService;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

/** The customer's KHQR / card sessions (docs/api/phase3-orders-checkout.md § Payments). */
@Tag(name = "Payments")
@RestController
@RequestMapping("/api/me/payments")
@RequiredArgsConstructor
public class PaymentController extends BaseController {

    private final PaymentService payments;

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<PaymentIntentResponse>> get(@PathVariable UUID id) {
        return ok(payments.get(CurrentUser.id(), id));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<PaymentIntentResponse>> cancel(@PathVariable UUID id) {
        return ok(payments.cancel(CurrentUser.id(), id));
    }

    /** LOCAL SIMULATOR (vbiz.payment.simulator.enabled): the bank confirms the KHQR transfer. */
    @PostMapping("/{id}/simulate")
    public ResponseEntity<ApiResponse<PaymentIntentResponse>> simulate(@PathVariable UUID id) {
        return ok(payments.simulatePaid(CurrentUser.id(), id));
    }
}
