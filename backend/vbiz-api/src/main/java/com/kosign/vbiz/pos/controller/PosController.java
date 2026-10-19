package com.kosign.vbiz.pos.controller;

import java.time.LocalDate;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.pos.payload.PosInputs;
import com.kosign.vbiz.pos.payload.PosSaleResponse;
import com.kosign.vbiz.pos.payload.ShiftResponse;
import com.kosign.vbiz.pos.service.PosService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/** The Seller register (docs/api/phase5-pos-promotions-reviews.md § POS). Needs X-Business-Id. */
@Tag(name = "POS")
@RestController
@RequestMapping("/api/pos")
@RequiredArgsConstructor
public class PosController extends BaseController {

    private final PosService pos;

    @GetMapping("/shift")
    public ResponseEntity<ApiResponse<ShiftResponse>> shift() {
        return ok(pos.openShift());
    }

    @PostMapping("/shift")
    public ResponseEntity<ApiResponse<ShiftResponse>> open(@Valid @RequestBody PosInputs.OpenShift in) {
        return created(pos.open(in));
    }

    @PostMapping("/shift/moves")
    public ResponseEntity<ApiResponse<ShiftResponse>> move(@Valid @RequestBody PosInputs.CashMove in) {
        return ok(pos.cashMove(in));
    }

    @PostMapping("/shift/close")
    public ResponseEntity<ApiResponse<ShiftResponse>> close(@Valid @RequestBody PosInputs.CloseShift in) {
        return ok(pos.close(in));
    }

    @GetMapping("/shifts")
    public ResponseEntity<ApiResponse<List<ShiftResponse>>> shifts(@RequestParam(required = false) Integer limit) {
        return ok(pos.closedShifts(limit));
    }

    @GetMapping("/sales")
    public ResponseEntity<ApiResponse<List<PosSaleResponse>>> sales(@RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to) {
        return ok(pos.list(from, to));
    }

    @PostMapping("/sales")
    public ResponseEntity<ApiResponse<PosSaleResponse>> ring(@Valid @RequestBody PosInputs.Sale in) {
        PosService.Rung r = pos.ring(in);
        return r.created() ? created(r.sale()) : ok(r.sale());
    }

    @PostMapping("/sales/{ref}/refunds")
    public ResponseEntity<ApiResponse<PosSaleResponse>> refund(@PathVariable String ref,
            @Valid @RequestBody PosInputs.Refund in) {
        return ok(pos.refund(ref, in));
    }
}
