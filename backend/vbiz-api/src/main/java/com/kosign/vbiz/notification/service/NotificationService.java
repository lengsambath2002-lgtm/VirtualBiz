package com.kosign.vbiz.notification.service;

import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.domain.Sort;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.common.list.PageResponse;
import com.kosign.vbiz.common.list.PageQuery;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.notification.domain.Notification;
import com.kosign.vbiz.notification.payload.NotificationResponse;
import com.kosign.vbiz.notification.repository.NotificationRepository;
import com.kosign.vbiz.notification.sse.StreamEvent;

import lombok.RequiredArgsConstructor;

/** The in-app inbox of customers and shops; every new entry is also pushed on the live stream. */
@Service
@RequiredArgsConstructor
public class NotificationService {

    static final int LIMIT = 50;

    private final NotificationRepository notifications;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    @Transactional
    public Notification toUser(UUID userId, String kind, Map<String, String> params, String route) {
        Notification n = create(kind, params, route);
        n.setUserId(userId);
        n = notifications.save(n);
        events.publishEvent(StreamEvent.toUser(userId, "notification", Map.of("id", n.getId().toString(),
                "kind", kind)));
        return n;
    }

    @Transactional
    public Notification toBusiness(UUID businessId, String kind, Map<String, String> params, String route) {
        Notification n = create(kind, params, route);
        n.setBusinessId(businessId);
        n = notifications.save(n);
        events.publishEvent(StreamEvent.toBusiness(businessId, "notification",
                Map.of("id", n.getId().toString(), "kind", kind)));
        return n;
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> ofUser(UUID userId) {
        return notifications.latestOfUser(userId, PageRequest.of(0, LIMIT)).stream().map(NotificationService::toResponse)
                .toList();
    }

    /** The shop's whole inbox, newest first, a page at a time (docs/api/phase17-more-lists.md). */
    @Transactional(readOnly = true)
    public PageResponse<NotificationResponse> historyOfBusiness(UUID businessId, boolean unreadOnly, String kind,
            Integer page, Integer size) {
        PageQuery pq = PageQuery.of(page, size, null, Map.of("at", "at"), "-at", null);
        Specification<Notification> spec = Specification.allOf(
                (r, q, cb) -> cb.equal(r.get("businessId"), businessId),
                unreadOnly ? (r, q, cb) -> cb.isTrue(r.get("unread")) : null,
                kind == null || kind.isBlank() ? null : (r, q, cb) -> cb.equal(r.get("kind"), kind));
        var result = notifications.findAll(spec, PageRequest.of(pq.page(), pq.size(),
                Sort.by("at").descending().and(Sort.by("id").descending())));
        return new PageResponse<>(result.getContent().stream().map(NotificationService::toResponse).toList(),
                result.getTotalElements(), pq.page(), pq.size());
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> ofBusiness(UUID businessId) {
        return notifications.latestOfBusiness(businessId, PageRequest.of(0, LIMIT)).stream()
                .map(NotificationService::toResponse).toList();
    }

    @Transactional
    public NotificationResponse readOfUser(UUID userId, UUID id) {
        Notification n = notifications.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new BusinessException(StatusCode.NOTIFICATION_NOT_FOUND));
        n.setUnread(false);
        return toResponse(n);
    }

    @Transactional
    public NotificationResponse readOfBusiness(UUID businessId, UUID id) {
        Notification n = notifications.findByIdAndBusinessId(id, businessId)
                .orElseThrow(() -> new BusinessException(StatusCode.NOTIFICATION_NOT_FOUND));
        n.setUnread(false);
        return toResponse(n);
    }

    @Transactional
    public void readAllOfUser(UUID userId) {
        notifications.readAllOfUser(userId);
    }

    @Transactional
    public void readAllOfBusiness(UUID businessId) {
        notifications.readAllOfBusiness(businessId);
    }

    private Notification create(String kind, Map<String, String> params, String route) {
        Notification n = new Notification();
        n.setKind(kind);
        n.setParams(params == null ? new LinkedHashMap<>() : new LinkedHashMap<>(params));
        n.setRoute(route);
        n.setUnread(true);
        n.setAt(clock.instant());
        return n;
    }

    public static NotificationResponse toResponse(Notification n) {
        return new NotificationResponse(n.getId().toString(), n.getKind(), n.getParams(), n.getRoute(), n.isUnread(),
                n.getAt());
    }
}
