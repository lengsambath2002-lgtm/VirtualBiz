package com.kosign.vbiz.activity.controller;

import java.time.LocalDate;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.activity.payload.ShopActivityResponse;
import com.kosign.vbiz.activity.service.ShopActivityLog;
import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.csv.CsvWriter;
import com.kosign.vbiz.common.list.PageResponse;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

/** The shop activity log. Needs X-Business-Id; owner or manager. */
@Tag(name = "Shop activity")
@RestController
@RequestMapping("/api/activity")
@RequiredArgsConstructor
public class ShopActivityController extends BaseController {

    private final ShopActivityLog log;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<ShopActivityResponse>>> page(
            @RequestParam(required = false) String q, @RequestParam(required = false) String action,
            @RequestParam(required = false) String targetType, @RequestParam(required = false) String targetId,
            @RequestParam(required = false) UUID actorId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return ok(log.page(new ShopActivityLog.Filter(q, action, targetType, targetId, actorId, from, to), page,
                size));
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(@RequestParam(required = false) String q,
            @RequestParam(required = false) String action, @RequestParam(required = false) String targetType,
            @RequestParam(required = false) String targetId, @RequestParam(required = false) UUID actorId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        CsvWriter csv = log.export(new ShopActivityLog.Filter(q, action, targetType, targetId, actorId, from, to));
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", java.nio.charset.StandardCharsets.UTF_8))
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("activity.csv").build().toString())
                .header("X-Row-Count", String.valueOf(csv.rows()))
                .body(csv.bytes());
    }
}
