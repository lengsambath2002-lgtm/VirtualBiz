package com.kosign.vbiz.pos.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.pos.payload.ReceiptView;
import com.kosign.vbiz.pos.service.ReceiptService;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

/** Shareable sale receipts: a link for the shop (member), the receipt for anyone with it. */
@Tag(name = "Receipts")
@RestController
@RequiredArgsConstructor
public class ReceiptController extends BaseController {

    private final ReceiptService receipts;

    /** Needs X-Business-Id. Returns {@code {token, path}}. */
    @PostMapping("/api/sales/{number}/share")
    public ResponseEntity<ApiResponse<Map<String, String>>> share(@PathVariable String number) {
        return ok(receipts.share(number));
    }

    @GetMapping("/api/receipts/{token}")
    public ResponseEntity<ApiResponse<ReceiptView>> view(@PathVariable String token) {
        return ok(receipts.view(token));
    }
}
