package com.kosign.vbiz.meta.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.meta.payload.CategoryResponse;
import com.kosign.vbiz.meta.payload.DistrictResponse;
import com.kosign.vbiz.meta.service.ReferenceDataService;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

/** Reference data (public): districts and platform categories. */
@Tag(name = "Meta")
@RestController
@RequestMapping("/api/meta")
@RequiredArgsConstructor
public class MetaController extends BaseController {

    private final ReferenceDataService reference;

    @GetMapping("/districts")
    public ResponseEntity<ApiResponse<List<DistrictResponse>>> districts() {
        return ok(reference.districts());
    }

    @GetMapping("/categories")
    public ResponseEntity<ApiResponse<List<CategoryResponse>>> categories(
            @RequestParam(required = false) BusinessType type,
            @RequestParam(required = false, defaultValue = "false") boolean marketplace) {
        return ok(reference.categories(type, marketplace));
    }
}
