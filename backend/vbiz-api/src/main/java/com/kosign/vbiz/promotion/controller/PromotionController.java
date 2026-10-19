package com.kosign.vbiz.promotion.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.promotion.payload.PromotionInput;
import com.kosign.vbiz.promotion.payload.PromotionResponse;
import com.kosign.vbiz.promotion.service.PromotionService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** A shop's promotions (docs/api/phase5-pos-promotions-reviews.md § Promotions). Needs X-Business-Id. */
@Tag(name = "Promotions")
@RestController
@RequestMapping("/api/promotions")
@RequiredArgsConstructor
public class PromotionController extends BaseController {

    private final PromotionService promotions;

    @GetMapping
    public ResponseEntity<ApiResponse<List<PromotionResponse>>> list() {
        return ok(promotions.list());
    }

    @PostMapping
    public ResponseEntity<ApiResponse<PromotionResponse>> create(@Valid @RequestBody PromotionInput in) {
        return created(promotions.create(in));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<PromotionResponse>> update(@PathVariable UUID id,
            @Valid @RequestBody PromotionInput in) {
        return ok(promotions.update(id, in));
    }

    @PostMapping("/{id}/end")
    public ResponseEntity<ApiResponse<PromotionResponse.Ended>> end(@PathVariable UUID id) {
        return ok(promotions.end(id));
    }
}
