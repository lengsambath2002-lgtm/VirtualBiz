package com.kosign.vbiz.business.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.business.payload.CategoryRequestInput;
import com.kosign.vbiz.business.payload.CategoryRequestResponse;
import com.kosign.vbiz.business.service.CategoryRequestService;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** A shop's marketplace-category suggestions. Needs X-Business-Id; owner or manager to submit. */
@Tag(name = "Category requests")
@RestController
@RequestMapping("/api/category-requests")
@RequiredArgsConstructor
public class CategoryRequestController extends BaseController {

    private final CategoryRequestService requests;

    @GetMapping
    public ResponseEntity<ApiResponse<List<CategoryRequestResponse>>> mine() {
        return ok(requests.mine());
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CategoryRequestResponse>> submit(@Valid @RequestBody CategoryRequestInput in) {
        return created(requests.submit(in));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<CategoryRequestResponse>> withdraw(@PathVariable UUID id) {
        return ok(requests.withdraw(id));
    }
}
