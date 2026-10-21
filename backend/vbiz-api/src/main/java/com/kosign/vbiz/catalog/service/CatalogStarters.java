package com.kosign.vbiz.catalog.service;

import java.util.List;
import java.util.Map;

/**
 * The groups a new shop starts with, by its platform category, so a café isn't handed
 * "Phones" and a spa isn't handed "Nails". The owner renames, adds and removes them freely.
 */
public final class CatalogStarters {

    private CatalogStarters() {
    }

    private static final Map<String, List<String>> COLLECTIONS = Map.of(
            "electronics", List.of("Phones", "Audio", "Wearables", "Laptops", "Accessories"),
            "fashion", List.of("Women", "Men", "Kids", "Shoes", "Accessories"),
            "cafe", List.of("Coffee", "Tea", "Food", "Desserts"),
            "grocery", List.of("Fresh", "Pantry", "Drinks", "Household"),
            "beauty-products", List.of("Skincare", "Make-up", "Hair care", "Fragrance"));

    private static final Map<String, List<String>> SERVICE_CATEGORIES = Map.of(
            "salon", List.of("Hair", "Nails", "Make-up"),
            "beauty", List.of("Hair", "Nails", "Make-up"),
            "spa", List.of("Massage", "Facial", "Body"),
            "repair", List.of("Phones", "Laptops", "Other repairs"),
            "fitness", List.of("Classes", "Personal training"));

    /** Product collections for a new product shop of this category (may be empty). */
    public static List<String> collections(String categoryId) {
        return COLLECTIONS.getOrDefault(categoryId, List.of());
    }

    /** Service categories for a new provider of this category. */
    public static List<String> serviceCategories(String categoryId) {
        return SERVICE_CATEGORIES.getOrDefault(categoryId, List.of("Services"));
    }
}
