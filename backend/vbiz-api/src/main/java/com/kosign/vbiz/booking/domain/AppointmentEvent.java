package com.kosign.vbiz.booking.domain;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
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
 * One line of an appointment's activity log ({@code code} + {@code params}, rendered by the client).
 * {@code before} is set on changes the shop can undo.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "appointment_event")
public class AppointmentEvent extends BaseEntity {

    @Column(name = "appointment_id", nullable = false, updatable = false)
    private UUID appointmentId;

    @Column(name = "code", length = 20, nullable = false)
    private String code;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "params", nullable = false)
    private Map<String, String> params = new LinkedHashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "before")
    private AppointmentSnapshot before;

    @Column(name = "by_user_id")
    private UUID byUserId;

    @Column(name = "at", nullable = false)
    private Instant at;
}
