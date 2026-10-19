package com.kosign.vbiz.booking.controller;

import java.time.LocalDate;
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

import com.kosign.vbiz.booking.payload.BlockInput;
import com.kosign.vbiz.booking.payload.BlockResponse;
import com.kosign.vbiz.booking.service.BlockService;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.api.EmptyJsonResponse;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** Calendar blocks (docs/api/phase4-bookings-provider.md § Blocks). Needs X-Business-Id. */
@Tag(name = "Appointments")
@RestController
@RequestMapping("/api/blocks")
@RequiredArgsConstructor
public class BlockController extends BaseController {

    private final BlockService blocks;

    @GetMapping
    public ResponseEntity<ApiResponse<List<BlockResponse>>> list(@RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to) {
        return ok(blocks.list(from, to));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<BlockResponse>> create(@Valid @RequestBody BlockInput in) {
        return created(blocks.create(in));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<EmptyJsonResponse>> delete(@PathVariable UUID id) {
        blocks.delete(id);
        return ok();
    }
}
