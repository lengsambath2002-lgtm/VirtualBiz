package com.kosign.vbiz.pos.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A counter sale: the provider's checkout (services, tip, retail items), possibly closing an
 * appointment. {@code total = subtotal − discount + tip}; the payments add up to it.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "sale")
public class Sale extends BaseEntity {

    @Column(name = "number", length = 12, nullable = false, updatable = false)
    private String number;

    @Column(name = "business_id", nullable = false, updatable = false)
    private UUID businessId;

    @Column(name = "appointment_id")
    private UUID appointmentId;

    @Column(name = "client_id")
    private UUID clientId;

    @Column(name = "shift_id")
    private UUID shiftId;

    @Column(name = "subtotal", precision = 12, scale = 2, nullable = false)
    private BigDecimal subtotal;

    @Column(name = "discount", precision = 12, scale = 2, nullable = false)
    private BigDecimal discount;

    @Column(name = "tip", precision = 12, scale = 2, nullable = false)
    private BigDecimal tip;

    @Column(name = "total", precision = 12, scale = 2, nullable = false)
    private BigDecimal total;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "cash")
    private CashTender cash;

    /** Counter sales: who it was for, as typed at the register (name or phone). */
    @Column(name = "customer_name", length = 80)
    private String customerName;

    @Column(name = "discount_reason", length = 20)
    private String discountReason;

    /** The register's own id for the sale (idempotent retries of an offline queue). */
    @Column(name = "client_ref", updatable = false)
    private UUID clientRef;

    @Column(name = "by_user_id")
    private UUID byUserId;

    @Column(name = "by_name", length = 80)
    private String byName;

    @Column(name = "at", nullable = false)
    private Instant at;

    /** Public receipt link token (null until shared). */
    @Column(name = "share_token", length = 64)
    private String shareToken;
}
