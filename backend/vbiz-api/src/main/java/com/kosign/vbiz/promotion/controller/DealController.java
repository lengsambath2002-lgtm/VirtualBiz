package com.kosign.vbiz.promotion.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.api.EmptyJsonResponse;
import com.kosign.vbiz.promotion.payload.DealInput;
import com.kosign.vbiz.promotion.payload.DealResponse;
import com.kosign.vbiz.promotion.service.DealService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** A shop's deals (docs/api/phase4-bookings-provider.md). Needs X-Business-Id. */
@Tag(name = "Deals")
@RestController
@RequestMapping("/api/deals")
@RequiredArgsConstructor
public class DealController extends BaseController {

    private final DealService deals;

    @GetMapping
    public ResponseEntity<ApiResponse<List<DealResponse>>> list() {
        return ok(deals.list());
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DealResponse>> create(@Valid @RequestBody DealInput in) {
        return created(deals.create(in));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<DealResponse>> update(@PathVariable UUID id, @Valid @RequestBody DealInput in) {
        return ok(deals.update(id, in));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<EmptyJsonResponse>> delete(@PathVariable UUID id) {
        deals.delete(id);
        return ok();
    }
}
