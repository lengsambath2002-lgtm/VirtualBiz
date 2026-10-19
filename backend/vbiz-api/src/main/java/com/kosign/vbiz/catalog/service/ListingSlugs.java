package com.kosign.vbiz.catalog.service;

import org.springframework.stereotype.Component;

import com.kosign.vbiz.business.service.BusinessRules;
import com.kosign.vbiz.catalog.repository.ProductRepository;
import com.kosign.vbiz.catalog.repository.ServiceItemRepository;

import lombok.RequiredArgsConstructor;

/**
 * Slugs for products and services share one namespace (customer URLs /p/{slug}, /s/{slug} and
 * saved-item keys): {@code "Iced Latte"} → {@code iced-latte}, then {@code -2}, {@code -3}, …
 */
@Component
@RequiredArgsConstructor
public class ListingSlugs {

    private final ProductRepository products;
    private final ServiceItemRepository services;

    public String unique(String title) {
        String base = BusinessRules.slugify(title);
        if (base.length() > 80) {
            base = base.substring(0, 80).replaceAll("-+$", "");
        }
        if (free(base)) {
            return base;
        }
        for (int n = 2; ; n++) {
            String candidate = base + "-" + n;
            if (free(candidate)) {
                return candidate;
            }
        }
    }

    private boolean free(String slug) {
        return !products.existsBySlug(slug) && !services.existsBySlug(slug);
    }
}
