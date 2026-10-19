package com.kosign.vbiz.review.service;

import java.time.Clock;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.repository.UserRepository;
import com.kosign.vbiz.booking.domain.Appointment;
import com.kosign.vbiz.booking.domain.AppointmentStatus;
import com.kosign.vbiz.booking.repository.AppointmentRepository;
import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.repository.BusinessRepository;
import com.kosign.vbiz.catalog.domain.Product;
import com.kosign.vbiz.catalog.domain.ServiceItem;
import com.kosign.vbiz.catalog.repository.ProductRepository;
import com.kosign.vbiz.catalog.repository.ServiceItemRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.notification.domain.NotificationKind;
import com.kosign.vbiz.notification.service.NotificationService;
import com.kosign.vbiz.order.domain.Order;
import com.kosign.vbiz.order.domain.OrderLine;
import com.kosign.vbiz.order.repository.OrderLineRepository;
import com.kosign.vbiz.order.repository.OrderRepository;
import com.kosign.vbiz.review.domain.Review;
import com.kosign.vbiz.review.domain.ReviewTarget;
import com.kosign.vbiz.review.payload.MyReviewResponse;
import com.kosign.vbiz.review.payload.ReviewInput;
import com.kosign.vbiz.review.repository.ReviewRepository;

import lombok.RequiredArgsConstructor;

/**
 * Customers reviewing what they bought or booked (docs/api/phase5-pos-promotions-reviews.md §
 * Reviews): checked against a delivered order or a completed booking, then the item's and the
 * shop's rating follow and the shop hears about it.
 */
@Service
@RequiredArgsConstructor
public class MyReviewService {

    private final ReviewRepository reviews;
    private final OrderRepository orders;
    private final OrderLineRepository orderLines;
    private final AppointmentRepository appointments;
    private final ProductRepository products;
    private final ServiceItemRepository services;
    private final BusinessRepository businesses;
    private final UserRepository users;
    private final NotificationService notifications;
    private final ReviewRatings ratings;
    private final Clock clock;

    @Transactional
    public MyReviewResponse write(UUID userId, ReviewInput in) {
        boolean byOrder = in.order() != null && !in.order().isBlank();
        boolean byBooking = in.booking() != null && !in.booking().isBlank();
        if (byOrder == byBooking) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "order", "Give an order or a booking");
        }
        User me = users.findById(userId).orElseThrow(() -> new BusinessException(StatusCode.USER_NOT_FOUND));
        Review r = new Review();
        String number;
        if (byOrder) {
            Order o = orders.findByNumber(in.order().trim().toUpperCase(Locale.ROOT))
                    .filter(x -> x.getCustomerId().equals(userId))
                    .orElseThrow(() -> BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "order",
                            "Not one of your orders"));
            if (!o.getStatus().isFulfilled()) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "order",
                        "Review it once it is delivered or picked up");
            }
            Product p = products.findBySlugAndDeletedAtIsNull(in.item().trim())
                    .orElseThrow(() -> BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "item", "Unknown item"));
            boolean inOrder = orderLines.findByOrderIdInOrderByPositionAsc(List.of(o.getId())).stream()
                    .map(OrderLine::getProductId).anyMatch(p.getId()::equals);
            if (!inOrder) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "item", "Not in that order");
            }
            if (reviews.existsByOrderIdAndTargetId(o.getId(), p.getId())) {
                throw new BusinessException(StatusCode.CONFLICT);
            }
            r.setBusinessId(o.getBusinessId());
            r.setTargetType(ReviewTarget.PRODUCT);
            r.setTargetId(p.getId());
            r.setOrderId(o.getId());
            o.setReviewed(true);
            number = o.getNumber();
        } else {
            Appointment a = appointments.findByNumber(in.booking().trim().toUpperCase(Locale.ROOT))
                    .filter(x -> userId.equals(x.getCustomerId()))
                    .orElseThrow(() -> BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "booking",
                            "Not one of your bookings"));
            if (a.getStatus() != AppointmentStatus.COMPLETED) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "booking",
                        "Review it after the visit");
            }
            ServiceItem s = services.findById(a.getServiceId()).orElseThrow();
            if (!s.getSlug().equals(in.item().trim())) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "item", "Not that booking's service");
            }
            if (reviews.existsByAppointmentIdAndTargetId(a.getId(), s.getId())) {
                throw new BusinessException(StatusCode.CONFLICT);
            }
            r.setBusinessId(a.getBusinessId());
            r.setTargetType(ReviewTarget.SERVICE);
            r.setTargetId(s.getId());
            r.setAppointmentId(a.getId());
            number = a.getNumber();
        }
        r.setAuthorId(userId);
        r.setAuthorName(me.getName());
        r.setStars(in.stars());
        r.setTags(new ArrayList<>(in.tags() == null ? List.of()
                : in.tags().stream().map(String::trim).filter(t -> !t.isEmpty()).distinct().toList()));
        r.setText(in.text() == null ? "" : in.text().trim());
        r.setVerified(true);
        r.setAt(clock.instant());
        try {
            r = reviews.saveAndFlush(r);
        } catch (DataIntegrityViolationException ex) {
            throw new BusinessException(StatusCode.CONFLICT);
        }
        ratings.recompute(r);
        Business b = businesses.findById(r.getBusinessId()).orElseThrow();
        notifications.toBusiness(b.getId(), NotificationKind.NEW_REVIEW,
                Map.of("name", me.getName(), "stars", String.valueOf(r.getStars())),
                b.getType() == BusinessType.SERVICE ? "/provider/marketing?tab=reviews" : "/seller/reviews");
        return toResponse(r, Map.of(r.getId(), number), Map.of(r.getTargetId(), in.item().trim()));
    }

    @Transactional(readOnly = true)
    public List<MyReviewResponse> mine(UUID userId) {
        List<Review> rows = reviews.findByAuthorIdOrderByAtDesc(userId);
        Map<UUID, String> numbers = new HashMap<>();
        Map<UUID, String> slugs = new HashMap<>();
        for (Review r : rows) {
            if (r.getOrderId() != null) {
                orders.findById(r.getOrderId()).ifPresent(o -> numbers.put(r.getId(), o.getNumber()));
            } else if (r.getAppointmentId() != null) {
                appointments.findById(r.getAppointmentId()).ifPresent(a -> numbers.put(r.getId(), a.getNumber()));
            }
            if (r.getTargetType() == ReviewTarget.PRODUCT) {
                products.findById(r.getTargetId()).ifPresent(p -> slugs.put(r.getTargetId(), p.getSlug()));
            } else {
                services.findById(r.getTargetId()).ifPresent(s -> slugs.put(r.getTargetId(), s.getSlug()));
            }
        }
        return rows.stream().map(r -> toResponse(r, numbers, slugs)).toList();
    }

    private static MyReviewResponse toResponse(Review r, Map<UUID, String> numbers, Map<UUID, String> slugs) {
        String n = numbers.get(r.getId());
        boolean order = r.getOrderId() != null;
        return new MyReviewResponse(r.getId().toString(), order ? n : null, order ? null : n,
                slugs.get(r.getTargetId()), r.getTargetType(), r.getStars(), List.copyOf(r.getTags()), r.getText(),
                r.getReply(), r.getAt());
    }
}
