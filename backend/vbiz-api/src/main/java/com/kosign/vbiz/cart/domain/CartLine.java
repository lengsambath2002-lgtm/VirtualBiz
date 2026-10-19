package com.kosign.vbiz.cart.domain;

import java.util.UUID;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A line of a signed-in customer's cart ({@code savedForLater} = the "Saved for later" list). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "cart_line")
public class CartLine extends BaseEntity {

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "variant_id", nullable = false)
    private UUID variantId;

    @Column(name = "qty", nullable = false)
    private int qty;

    @Column(name = "selected", nullable = false)
    private boolean selected = true;

    @Column(name = "saved_for_later", nullable = false)
    private boolean savedForLater;

    @Column(name = "position", nullable = false)
    private int position;
}
