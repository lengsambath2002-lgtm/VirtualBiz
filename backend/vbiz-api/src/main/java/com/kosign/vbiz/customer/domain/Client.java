package com.kosign.vbiz.customer.domain;

import java.time.Instant;
import java.util.UUID;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A business's customer record (the provider's clients). {@code userId} links the account of a
 * customer who booked online; phone and walk-in clients have none. The phone is unique per business.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "client")
public class Client extends BaseEntity {

    @Column(name = "business_id", nullable = false, updatable = false)
    private UUID businessId;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "name", length = 80, nullable = false)
    private String name;

    @Column(name = "phone", length = 10, nullable = false)
    private String phone;

    @Column(name = "email", length = 254)
    private String email;

    @Column(name = "note", length = 500)
    private String note;

    @Column(name = "district", length = 80)
    private String district;

    @Column(name = "since", nullable = false)
    private Instant since;
}
