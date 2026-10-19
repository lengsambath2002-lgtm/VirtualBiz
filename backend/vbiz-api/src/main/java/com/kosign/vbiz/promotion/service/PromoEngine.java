package com.kosign.vbiz.promotion.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.kosign.vbiz.common.helper.Money;
import com.kosign.vbiz.promotion.domain.Promotion;
import com.kosign.vbiz.promotion.domain.PromotionState;
import com.kosign.vbiz.promotion.domain.PromotionType;

/**
 * A promo code against a checkout (docs/api/phase3-orders-checkout.md § Checkout, rule 4),
 * mirroring {@code frontend/src/lib/pricing/promo.ts}, and a shop's automatic promotions
 * (docs/api/phase5-pos-promotions-reviews.md § Promotions). Pure: the caller loads them.
 */
public final class PromoEngine {

    /** Why a code does not apply. */
    public enum Reason { UNKNOWN, SCHEDULED, ENDED, USED_UP, MIN_SPEND, NOT_APPLICABLE }

    /** One priced checkout line; {@code total} is after shop discounts. */
    public record PromoLine(UUID businessId, UUID productId, String productSlug, String categoryId,
            UUID collectionId, BigDecimal total) {
    }

    /** A shop's best automatic promotion: the discount, or the delivery fee it waives. */
    public record Auto(Promotion promotion, BigDecimal discount, boolean freeShipping) {
    }

    /**
     * {@code discountByShop}: each shop's share (shops in first-seen order, summing exactly to the
     * discount); {@code freeShippingShops}: shops whose delivery fee a FREE_SHIPPING code waives.
     */
    public record Result(Promotion promotion, boolean applied, Reason reason, BigDecimal shortBy,
            BigDecimal discount, Map<UUID, BigDecimal> discountByShop, Set<UUID> freeShippingShops) {

        static Result refused(Promotion p, Reason reason, BigDecimal shortBy) {
            return new Result(p, false, reason, shortBy, Money.ZERO, Map.of(), Set.of());
        }

        public BigDecimal shareOf(UUID businessId) {
            return discountByShop.getOrDefault(businessId, Money.ZERO);
        }
    }

    private PromoEngine() {
    }

    public static Result evaluate(Promotion p, List<PromoLine> lines, Instant now) {
        if (p == null || p.getCode() == null) {
            return Result.refused(p, Reason.UNKNOWN, null);
        }
        return apply(p, lines, now);
    }

    /**
     * The best of a shop's automatic promotions (no code) on its lines: the largest discount, a
     * free-delivery one counting as the {@code fee} it waives. Null when none applies.
     */
    public static Auto bestAutomatic(List<Promotion> automatic, List<PromoLine> shopLines, BigDecimal fee,
            Instant now) {
        Auto best = null;
        for (Promotion p : automatic) {
            if (p.getCode() != null) {
                continue;
            }
            Result r = apply(p, shopLines, now);
            if (!r.applied()) {
                continue;
            }
            boolean free = p.getType() == PromotionType.FREE_SHIPPING;
            BigDecimal worth = free ? fee : r.discount();
            if (worth.signum() <= 0) {
                continue;
            }
            BigDecimal bestWorth = best == null ? null : best.freeShipping() ? fee : best.discount();
            if (best == null || worth.compareTo(bestWorth) > 0) {
                best = new Auto(p, free ? Money.ZERO : r.discount(), free);
            }
        }
        return best;
    }

    private static Result apply(Promotion p, List<PromoLine> lines, Instant now) {
        PromotionState state = PromotionState.derive(p.getStartsAt(), p.getEndsAt(), p.getUses(),
                p.getUsageLimit() == null ? null : p.getUsageLimit().longValue(), now);
        switch (state) {
            case ENDED -> {
                return Result.refused(p, Reason.ENDED, null);
            }
            case USED_UP -> {
                return Result.refused(p, Reason.USED_UP, null);
            }
            case SCHEDULED -> {
                return Result.refused(p, Reason.SCHEDULED, null);
            }
            default -> {
                // ACTIVE
            }
        }
        Map<UUID, BigDecimal> eligible = new LinkedHashMap<>();
        for (PromoLine l : lines) {
            if (isEligible(p, l)) {
                eligible.merge(l.businessId(), l.total(), BigDecimal::add);
            }
        }
        BigDecimal base = eligible.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        if (eligible.isEmpty() || base.signum() <= 0) {
            return Result.refused(p, Reason.NOT_APPLICABLE, null);
        }
        if (p.getMinSpend() != null && base.compareTo(p.getMinSpend()) < 0) {
            return Result.refused(p, Reason.MIN_SPEND, Money.usd(p.getMinSpend().subtract(base)));
        }
        if (p.getType() == PromotionType.FREE_SHIPPING) {
            return new Result(p, true, null, null, Money.ZERO, Map.of(), new LinkedHashSet<>(eligible.keySet()));
        }
        BigDecimal discount = switch (p.getType()) {
            case PERCENT -> {
                BigDecimal raw = base.multiply(p.getValue()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                yield p.getMaxDiscount() != null && raw.compareTo(p.getMaxDiscount()) > 0
                        ? Money.usd(p.getMaxDiscount()) : raw;
            }
            case FIXED -> Money.usd(p.getValue().min(base));
            case FREE_SHIPPING -> Money.ZERO;
        };
        return new Result(p, true, null, null, discount, allocate(discount, eligible, base), Set.of());
    }

    /** Scope: the shop's own code only covers its lines; then ALL / CATEGORY / PRODUCTS. */
    static boolean isEligible(Promotion p, PromoLine l) {
        if (p.getBusinessId() != null && !p.getBusinessId().equals(l.businessId())) {
            return false;
        }
        List<String> targets = p.getTargetIds() == null ? List.of() : p.getTargetIds();
        return switch (p.getScope()) {
            case ALL -> true;
            // Platform categories, or (a shop's own promotion) its collections.
            case CATEGORY -> targets.contains(l.categoryId())
                    || (l.collectionId() != null && targets.contains(l.collectionId().toString()));
            case PRODUCTS -> targets.contains(l.productId().toString()) || targets.contains(l.productSlug());
        };
    }

    /** Proportional split to the cent; the last shop takes the remainder so the parts add up. */
    static Map<UUID, BigDecimal> allocate(BigDecimal discount, Map<UUID, BigDecimal> eligible, BigDecimal base) {
        Map<UUID, BigDecimal> out = new LinkedHashMap<>();
        List<UUID> shops = new ArrayList<>(eligible.keySet());
        BigDecimal given = BigDecimal.ZERO;
        for (int i = 0; i < shops.size(); i++) {
            UUID id = shops.get(i);
            BigDecimal share = i == shops.size() - 1
                    ? discount.subtract(given)
                    : discount.multiply(eligible.get(id)).divide(base, 2, RoundingMode.HALF_UP);
            share = share.min(eligible.get(id)).max(BigDecimal.ZERO);
            given = given.add(share);
            out.put(id, Money.usd(share));
        }
        return out;
    }
}
