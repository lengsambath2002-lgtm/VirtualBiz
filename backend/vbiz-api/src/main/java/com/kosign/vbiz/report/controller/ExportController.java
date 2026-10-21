package com.kosign.vbiz.report.controller;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.payment.domain.PaymentMethod;
import com.kosign.vbiz.order.domain.OrderSource;
import com.kosign.vbiz.order.domain.FulfilmentMethod;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.report.service.ExportService;
import com.kosign.vbiz.report.service.ExportService.Export;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

/** CSV downloads of a shop's records. Needs X-Business-Id; owner or manager. */
@Tag(name = "Exports")
@RestController
@RequiredArgsConstructor
public class ExportController extends BaseController {

    private static final MediaType CSV = new MediaType("text", "csv", java.nio.charset.StandardCharsets.UTF_8);

    private final ExportService exports;

    /** {@code kind}: orders, products, sales, appointments or customers. Dates are Phnom Penh days. */
    @GetMapping("/api/exports/{kind}")
    public ResponseEntity<byte[]> export(@PathVariable String kind,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String tab, @RequestParam(required = false) String q,
            @RequestParam(required = false) FulfilmentMethod method, @RequestParam(required = false) PaymentMethod pay,
            @RequestParam(required = false) OrderSource source) {
        Export e = exports.export(kind, from, to, new ExportService.OrderFilters(tab, q, method, pay, source));
        return ResponseEntity.ok()
                .contentType(CSV)
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(e.filename()).build().toString())
                .header("X-Row-Count", String.valueOf(e.rows()))
                .body(e.csv());
    }
}
