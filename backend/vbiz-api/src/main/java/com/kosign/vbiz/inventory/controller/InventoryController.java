package com.kosign.vbiz.inventory.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.inventory.payload.RevertResponse;
import com.kosign.vbiz.inventory.payload.StockAlertResponse;
import com.kosign.vbiz.inventory.payload.StockMovementResponse;
import com.kosign.vbiz.inventory.payload.StockWriteRequest;
import com.kosign.vbiz.inventory.payload.StockWriteResponse;
import com.kosign.vbiz.inventory.service.InventoryService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** Stock movements and alerts (docs/api/phase2-catalog-inventory.md § Inventory). Needs X-Business-Id. */
@Tag(name = "Inventory")
@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController extends BaseController {

    private final InventoryService inventory;

    @GetMapping("/movements")
    public ResponseEntity<ApiResponse<List<StockMovementResponse>>> movements(
            @RequestParam(required = false) UUID variantId,
            @RequestParam(required = false) UUID productId,
            @RequestParam(required = false) Integer limit) {
        return ok(inventory.movements(variantId, productId, limit));
    }

    @PostMapping("/movements")
    public ResponseEntity<ApiResponse<StockWriteResponse>> write(@Valid @RequestBody StockWriteRequest req) {
        return created(inventory.write(req));
    }

    @DeleteMapping("/movements/{id}")
    public ResponseEntity<ApiResponse<RevertResponse>> revert(@PathVariable UUID id) {
        return ok(inventory.revert(id));
    }

    @GetMapping("/alerts")
    public ResponseEntity<ApiResponse<List<StockAlertResponse>>> alerts(
            @RequestParam(required = false) String state) {
        return ok(inventory.alerts(state));
    }
}
