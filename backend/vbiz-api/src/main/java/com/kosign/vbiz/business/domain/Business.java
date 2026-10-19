package com.kosign.vbiz.business.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A business: a product shop or a service provider. {@code hours} has 7 entries, Monday first,
 * each {@code [openMin, closeMin]} or {@code null} when closed.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "business")
public class Business extends BaseEntity {

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", length = 10, nullable = false, updatable = false)
    private BusinessType type;

    @Column(name = "name", length = 80, nullable = false)
    private String name;

    @Column(name = "slug", length = 90, nullable = false, updatable = false)
    private String slug;

    @Column(name = "category_id", length = 40, nullable = false)
    private String categoryId;

    @Column(name = "about", length = 1000)
    private String about;

    @Column(name = "phone", length = 10, nullable = false)
    private String phone;

    @Column(name = "email", length = 254)
    private String email;

    @Column(name = "district", length = 80, nullable = false)
    private String district;

    @Column(name = "street", length = 200, nullable = false)
    private String street;

    @Column(name = "lat", precision = 9, scale = 6)
    private BigDecimal lat;

    @Column(name = "lng", precision = 9, scale = 6)
    private BigDecimal lng;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "hours", nullable = false)
    private List<List<Integer>> hours = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "closures", nullable = false)
    private List<Closure> closures = new ArrayList<>();

    @Column(name = "online", nullable = false)
    private boolean online = true;

    @Column(name = "logo_url", length = 500)
    private String logoUrl;

    @Column(name = "cover_url", length = 500)
    private String coverUrl;

    /** Where payouts go; null until the owner adds it ("Get paid" is optional at creation). */
    @Column(name = "bakong_id", length = 100)
    private String bakongId;

    @Enumerated(EnumType.STRING)
    @Column(name = "verification", length = 10, nullable = false)
    private VerificationStatus verification = VerificationStatus.PENDING;

    /** The admin's decision: when, by whom, and (on rejection) the reason the owner sees. */
    @Column(name = "verified_at")
    private Instant verifiedAt;

    @Column(name = "verified_by")
    private UUID verifiedBy;

    @Column(name = "verification_note", length = 300)
    private String verificationNote;

    /** Set while an admin has suspended the shop: hidden, no new orders or bookings. */
    @Column(name = "suspended_at")
    private Instant suspendedAt;

    @Column(name = "suspended_reason", length = 300)
    private String suspendedReason;

    @Column(name = "rating", precision = 2, scale = 1, nullable = false)
    private BigDecimal rating = BigDecimal.ZERO;

    @Column(name = "review_count", nullable = false)
    private int reviewCount;

    @Column(name = "since", nullable = false)
    private Instant since;

    /** Marketplace display: typical reply time in minutes ("Replies in ~10 min"). */
    @Column(name = "reply_minutes")
    private Integer replyMinutes;

    /** Marketplace display: delivery ETA window in minutes (product shops). */
    @Column(name = "eta_min")
    private Integer etaMin;

    @Column(name = "eta_max")
    private Integer etaMax;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "product_settings")
    private ProductSettings productSettings;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "booking_settings")
    private BookingSettings bookingSettings;

    public boolean isSuspended() {
        return suspendedAt != null;
    }
}
