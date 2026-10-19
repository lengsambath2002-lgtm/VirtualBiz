package com.kosign.vbiz.catalog.payload;

import com.kosign.vbiz.catalog.domain.ProductStatus;

import jakarta.validation.constraints.NotNull;

public record StatusInput(@NotNull ProductStatus status) {
}
