package com.kosign.vbiz.notification.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kosign.vbiz.common.api.ApiResponse;
import com.kosign.vbiz.common.api.BaseController;
import com.kosign.vbiz.common.api.EmptyJsonResponse;
import com.kosign.vbiz.common.security.CurrentUser;
import com.kosign.vbiz.notification.payload.NotificationResponse;
import com.kosign.vbiz.notification.service.NotificationService;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

/** The customer's inbox (docs/api/phase3-orders-checkout.md § Notifications). */
@Tag(name = "Notifications")
@RestController
@RequestMapping("/api/me/notifications")
@RequiredArgsConstructor
public class MyNotificationController extends BaseController {

    private final NotificationService notifications;

    @GetMapping
    public ResponseEntity<ApiResponse<List<NotificationResponse>>> list() {
        return ok(notifications.ofUser(CurrentUser.id()));
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<ApiResponse<NotificationResponse>> read(@PathVariable UUID id) {
        return ok(notifications.readOfUser(CurrentUser.id(), id));
    }

    @PostMapping("/read-all")
    public ResponseEntity<ApiResponse<EmptyJsonResponse>> readAll() {
        notifications.readAllOfUser(CurrentUser.id());
        return ok();
    }
}
