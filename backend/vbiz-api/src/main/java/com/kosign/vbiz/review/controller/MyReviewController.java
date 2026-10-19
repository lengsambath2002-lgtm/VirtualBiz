package com.kosign.vbiz.review.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.security.CurrentUser;
import com.kosign.vbiz.review.payload.MyReviewResponse;
import com.kosign.vbiz.review.payload.ReviewInput;
import com.kosign.vbiz.review.service.MyReviewService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** Reviews the customer writes (docs/api/phase5-pos-promotions-reviews.md § Reviews). */
@Tag(name = "Reviews")
@RestController
@RequestMapping("/api/me/reviews")
@RequiredArgsConstructor
public class MyReviewController extends BaseController {

    private final MyReviewService reviews;

    @GetMapping
    public ResponseEntity<ApiResponse<List<MyReviewResponse>>> mine() {
        return ok(reviews.mine(CurrentUser.id()));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<MyReviewResponse>> write(@Valid @RequestBody ReviewInput in) {
        return created(reviews.write(CurrentUser.id(), in));
    }
}
