package com.kosign.vbiz.catalog.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.catalog.payload.CollectionResponse;
import com.kosign.vbiz.catalog.payload.ProductInput;
import com.kosign.vbiz.catalog.payload.SellerProductResponse;
import com.kosign.vbiz.catalog.payload.StatusInput;
import com.kosign.vbiz.catalog.service.CollectionService;
import com.kosign.vbiz.catalog.service.ProductService;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.api.EmptyJsonResponse;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** Seller products and collections (docs/api/phase2-catalog-inventory.md § Seller catalog). Needs X-Business-Id. */
@Tag(name = "Catalog")
@RestController
@RequestMapping("/api/catalog")
@RequiredArgsConstructor
public class ProductController extends BaseController {

    private final ProductService products;
    private final CollectionService collectionService;

    @GetMapping("/products")
    public ResponseEntity<ApiResponse<List<SellerProductResponse>>> list() {
        return ok(products.list());
    }

    @GetMapping("/products/{id}")
    public ResponseEntity<ApiResponse<SellerProductResponse>> get(@PathVariable UUID id) {
        return ok(products.get(id));
    }

    @PostMapping("/products")
    public ResponseEntity<ApiResponse<SellerProductResponse>> create(@RequestBody ProductInput input) {
        return created(products.create(input));
    }

    @PutMapping("/products/{id}")
    public ResponseEntity<ApiResponse<SellerProductResponse>> update(@PathVariable UUID id,
            @RequestBody ProductInput input) {
        return ok(products.update(id, input));
    }

    @PatchMapping("/products/{id}/status")
    public ResponseEntity<ApiResponse<SellerProductResponse>> status(@PathVariable UUID id,
            @Valid @RequestBody StatusInput input) {
        return ok(products.setStatus(id, input.status()));
    }

    @PostMapping("/products/{id}/duplicate")
    public ResponseEntity<ApiResponse<SellerProductResponse>> duplicate(@PathVariable UUID id) {
        return created(products.duplicate(id));
    }

    @DeleteMapping("/products/{id}")
    public ResponseEntity<ApiResponse<EmptyJsonResponse>> delete(@PathVariable UUID id) {
        products.delete(id);
        return ok();
    }

    @GetMapping("/collections")
    public ResponseEntity<ApiResponse<List<CollectionResponse>>> collections() {
        return ok(collectionService.list());
    }

    /** Body: {@code {"name": "…"}}. */
    @PostMapping("/collections")
    public ResponseEntity<ApiResponse<List<CollectionResponse>>> createCollection(
            @RequestBody java.util.Map<String, String> body) {
        return created(collectionService.create(body.get("name")));
    }

    @PatchMapping("/collections/{id}")
    public ResponseEntity<ApiResponse<List<CollectionResponse>>> renameCollection(@PathVariable UUID id,
            @RequestBody java.util.Map<String, String> body) {
        return ok(collectionService.rename(id, body.get("name")));
    }

    /** Its products move to {@code moveTo}, or to no collection. */
    @DeleteMapping("/collections/{id}")
    public ResponseEntity<ApiResponse<List<CollectionResponse>>> deleteCollection(@PathVariable UUID id,
            @RequestParam(required = false) UUID moveTo) {
        return ok(collectionService.delete(id, moveTo));
    }

    /** Body: every collection id in the new order. */
    @PutMapping("/collections/order")
    public ResponseEntity<ApiResponse<List<CollectionResponse>>> reorderCollections(@RequestBody List<UUID> ids) {
        return ok(collectionService.reorder(ids));
    }
}
