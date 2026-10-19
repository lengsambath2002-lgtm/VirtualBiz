package com.kosign.vbiz.review.payload;

import java.util.List;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /api/me/reviews}: a product from a delivered order ({@code order}) or a service from
 * a completed booking ({@code booking}); {@code item} is the listing slug.
 */
public record ReviewInput(
        @Size(max = 40) String order,
        @Size(max = 40) String booking,
        @NotBlank @Size(max = 90) String item,
        @NotNull @Min(1) @Max(5) Integer stars,
        @Size(max = 5) List<@Size(max = 30) String> tags,
        @Size(max = 1000) String text) {
}
