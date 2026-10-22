package com.kosign.vbiz.admin.payload;

import jakarta.validation.constraints.Size;

/**
 * Approving a shop's category suggestion: {@code categoryId} maps it to an existing category;
 * otherwise a new category is made from {@code name} / {@code nameKh} / {@code icon} / {@code tint}
 * (the suggestion's names when left out). {@code moveShop} (default true) puts the shop in it.
 * Declining: {@code reason}, which the shop reads.
 */
public record CategoryDecisionInput(@Size(max = 40) String categoryId, @Size(max = 40) String name,
        @Size(max = 40) String nameKh, @Size(max = 30) String icon, Integer tint, Boolean moveShop,
        @Size(max = 300) String reason) {
}
