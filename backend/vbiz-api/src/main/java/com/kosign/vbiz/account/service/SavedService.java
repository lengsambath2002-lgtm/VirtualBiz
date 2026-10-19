package com.kosign.vbiz.account.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.account.domain.SavedListing;
import com.kosign.vbiz.account.domain.SavedTarget;
import com.kosign.vbiz.account.payload.SavedEntryResponse;
import com.kosign.vbiz.account.repository.SavedListingRepository;
import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.repository.BusinessRepository;
import com.kosign.vbiz.catalog.domain.Product;
import com.kosign.vbiz.catalog.domain.ServiceItem;
import com.kosign.vbiz.catalog.repository.ProductRepository;
import com.kosign.vbiz.catalog.repository.ServiceItemRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

import lombok.RequiredArgsConstructor;

/** Saved items and followed shops (heart / Follow). Keys: a listing slug or {@code shop:} + shop slug. */
@Service
@RequiredArgsConstructor
public class SavedService {

    public static final String SHOP_PREFIX = "shop:";
    static final int MAX_ENTRIES = 500;

    private final SavedListingRepository saved;
    private final ProductRepository products;
    private final ServiceItemRepository services;
    private final BusinessRepository businesses;

    private record Target(SavedTarget type, UUID id, String key) {
    }

    @Transactional(readOnly = true)
    public List<SavedEntryResponse> list(UUID userId) {
        List<SavedEntryResponse> out = new ArrayList<>();
        for (SavedListing s : saved.findByUserIdOrderByCreatedAtDescIdAsc(userId)) {
            keyOf(s).ifPresent(k -> out.add(new SavedEntryResponse(k, s.getTargetType(),
                    s.getTargetId().toString(), s.getCreatedAt())));
        }
        return out;
    }

    @Transactional
    public List<SavedEntryResponse> save(UUID userId, String key) {
        Target t = resolve(key);
        if (saved.findByUserIdAndTargetTypeAndTargetId(userId, t.type(), t.id()).isEmpty()) {
            if (saved.countByUserId(userId) >= MAX_ENTRIES) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "key", "At most 500 saved entries");
            }
            SavedListing s = new SavedListing();
            s.setUserId(userId);
            s.setTargetType(t.type());
            s.setTargetId(t.id());
            saved.saveAndFlush(s);
        }
        return list(userId);
    }

    @Transactional
    public List<SavedEntryResponse> remove(UUID userId, String key) {
        Target t = resolve(key);
        saved.findByUserIdAndTargetTypeAndTargetId(userId, t.type(), t.id()).ifPresent(s -> {
            saved.delete(s);
            saved.flush();
        });
        return list(userId);
    }

    private Target resolve(String raw) {
        String key = raw == null ? "" : raw.trim();
        if (key.startsWith(SHOP_PREFIX)) {
            String slug = key.substring(SHOP_PREFIX.length());
            Business b = businesses.findBySlug(slug)
                    .orElseThrow(() -> new BusinessException(StatusCode.BUSINESS_NOT_FOUND));
            return new Target(SavedTarget.SHOP, b.getId(), key);
        }
        Optional<Product> p = products.findBySlugAndDeletedAtIsNull(key);
        if (p.isPresent()) {
            return new Target(SavedTarget.PRODUCT, p.get().getId(), key);
        }
        ServiceItem s = services.findBySlugAndDeletedAtIsNull(key)
                .orElseThrow(() -> new BusinessException(StatusCode.LISTING_NOT_FOUND));
        return new Target(SavedTarget.SERVICE, s.getId(), key);
    }

    /** The client key of an entry; empty when its listing / shop is gone. */
    private Optional<String> keyOf(SavedListing s) {
        return switch (s.getTargetType()) {
            case PRODUCT -> products.findById(s.getTargetId()).filter(p -> p.getDeletedAt() == null)
                    .map(Product::getSlug);
            case SERVICE -> services.findById(s.getTargetId()).filter(x -> x.getDeletedAt() == null)
                    .map(ServiceItem::getSlug);
            case SHOP -> businesses.findById(s.getTargetId()).map(b -> SHOP_PREFIX + b.getSlug());
        };
    }
}
