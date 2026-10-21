package com.kosign.vbiz.catalog.controller;

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

import com.kosign.vbiz.common.list.BulkResult;
import com.kosign.vbiz.catalog.payload.ProviderServiceResponse;
import com.kosign.vbiz.catalog.payload.ServiceInput;
import com.kosign.vbiz.catalog.service.ServiceItemService;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.api.EmptyJsonResponse;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

/** Provider services (docs/api/phase2-catalog-inventory.md § Provider services). Needs X-Business-Id. */
@Tag(name = "Catalog")
@RestController
@RequestMapping("/api/catalog/services")
@RequiredArgsConstructor
public class ServiceItemController extends BaseController {

    private final ServiceItemService services;

    /** Body: {@code {"from": "Hair", "to": "Hair & beauty"}}; returns the shop's category list. */
    /** {@code {ids, online}}: online booking on or off for several services. */
    @PostMapping("/online")
    public ResponseEntity<ApiResponse<BulkResult>> setOnline(@RequestBody OnlineInput in) {
        return ok(services.setBookableOnline(in.ids(), in.online()));
    }

    public record OnlineInput(@jakarta.validation.constraints.NotEmpty java.util.List<java.util.UUID> ids,
            boolean online) {
    }

    @PostMapping("/categories/rename")
    public ResponseEntity<ApiResponse<List<String>>> renameCategory(@RequestBody java.util.Map<String, String> body) {
        return ok(services.renameCategory(body.get("from"), body.get("to")));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ProviderServiceResponse>>> list() {
        return ok(services.list());
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ProviderServiceResponse>> create(@RequestBody ServiceInput input) {
        return created(services.create(input));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<ProviderServiceResponse>> update(@PathVariable UUID id,
            @RequestBody ServiceInput input) {
        return ok(services.update(id, input));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<EmptyJsonResponse>> delete(@PathVariable UUID id) {
        services.delete(id);
        return ok();
    }
}
