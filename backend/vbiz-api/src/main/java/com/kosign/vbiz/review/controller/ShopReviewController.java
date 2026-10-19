package com.kosign.vbiz.review.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.review.payload.ReplyInput;
import com.kosign.vbiz.review.payload.ShopReviewResponse;
import com.kosign.vbiz.review.service.ShopReviewService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** The shop's reviews and replies (docs/api/phase4-bookings-provider.md). Needs X-Business-Id. */
@Tag(name = "Reviews")
@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class ShopReviewController extends BaseController {

    private final ShopReviewService reviews;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ShopReviewResponse>>> list() {
        return ok(reviews.list());
    }

    @PostMapping("/{id}/reply")
    public ResponseEntity<ApiResponse<ShopReviewResponse>> reply(@PathVariable UUID id,
            @Valid @RequestBody ReplyInput in) {
        return ok(reviews.reply(id, in.text()));
    }
}
