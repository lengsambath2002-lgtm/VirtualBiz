package com.kosign.vbiz.report.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.catalog.service.ProductImportService;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.imports.ImportReport;
import com.kosign.vbiz.common.imports.ImportRequest;
import com.kosign.vbiz.customer.service.ClientImportService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * CSV imports (docs/api/phase16-shop-lists.md). Needs X-Business-Id; owner or manager. With
 * {@code dryRun=true} (the default) nothing is saved and the report says what would happen.
 */
@Tag(name = "Imports")
@RestController
@RequiredArgsConstructor
public class ImportController extends BaseController {

    private final ProductImportService products;
    private final ClientImportService customers;

    @PostMapping("/api/imports/{kind}")
    public ResponseEntity<ApiResponse<ImportReport>> run(@PathVariable String kind,
            @RequestParam(defaultValue = "true") boolean dryRun,
            @RequestParam(defaultValue = "false") boolean skipInvalid, @Valid @RequestBody ImportRequest in) {
        return ok(switch (kind) {
            case "products" -> products.run(in.rows(), dryRun, skipInvalid);
            case "customers" -> customers.run(in.rows(), dryRun, skipInvalid);
            default -> throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "kind",
                    "products or customers");
        });
    }
}
