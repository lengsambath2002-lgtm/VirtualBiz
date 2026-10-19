package com.kosign.vbiz.pos.controller;

import java.time.LocalDate;
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
import com.kosign.vbiz.pos.payload.SaleInput;
import com.kosign.vbiz.pos.payload.SaleResponse;
import com.kosign.vbiz.pos.service.SaleService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** The provider's checkout sales (docs/api/phase4-bookings-provider.md § Sales). Needs X-Business-Id. */
@Tag(name = "Sales")
@RestController
@RequestMapping("/api/sales")
@RequiredArgsConstructor
public class SaleController extends BaseController {

    private final SaleService sales;

    @GetMapping
    public ResponseEntity<ApiResponse<List<SaleResponse>>> list(@RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to) {
        return ok(sales.list(from, to));
    }

    @GetMapping("/{ref}")
    public ResponseEntity<ApiResponse<SaleResponse>> get(@PathVariable String ref) {
        return ok(sales.get(ref));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<SaleResponse>> create(@Valid @RequestBody SaleInput in) {
        return created(sales.create(in));
    }
}
