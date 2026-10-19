package com.kosign.vbiz.booking.domain;

import java.time.LocalDate;
import java.util.UUID;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Time a staff member is not bookable (lunch, training, …). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "calendar_block")
public class CalendarBlock extends BaseEntity {

    @Column(name = "business_id", nullable = false, updatable = false)
    private UUID businessId;

    @Column(name = "staff_id", nullable = false)
    private UUID staffId;

    @Column(name = "date", nullable = false)
    private LocalDate date;

    @Column(name = "start_min", nullable = false)
    private int start;

    @Column(name = "duration_min", nullable = false)
    private int durationMin;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason", length = 10, nullable = false)
    private BlockReason reason;
}
