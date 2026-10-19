package com.kosign.vbiz.order.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.domain.ProductSettings;
import com.kosign.vbiz.catalog.domain.Product;
import com.kosign.vbiz.catalog.domain.ProductVariant;
import com.kosign.vbiz.common.helper.Money;
import com.kosign.vbiz.delivery.service.DeliveryFees;
import com.kosign.vbiz.order.domain.FulfilmentMethod;
import com.kosign.vbiz.promotion.domain.Promotion;
import com.kosign.vbiz.promotion.service.PromoEngine;

/**
 * Prices a checkout (docs/api/phase3-orders-checkout.md § Checkout, rules 1–5). Pure: the caller
 * loads the variants, products, shops and the promotion; quote and placement share this code so
 * a placed checkout always matches its quote.
 */
public final class CheckoutPricer {

    /** A requested line with what it refers to (null = the variant is gone or not listed). */
    public record Input(int index, UUID variantId, int qty, ProductVariant variant, Product product, Business shop) {
    }

    public record Line(int index, ProductVariant variant, Product product, Business shop, int qty,
            BigDecimal listPrice, BigDecimal unitPrice) {

        public BigDecimal listTotal() {
            return listPrice.multiply(BigDecimal.valueOf(qty));
        }

        public BigDecimal netTotal() {
            return unitPrice.multiply(BigDecimal.valueOf(qty));
        }
    }

    /** {@code auto}: the shop's automatic promotion that applied (its discount is in {@code promoDiscount}). */
    public record Shop(Business shop, List<Line> lines, BigDecimal subtotal, BigDecimal discount,
            BigDecimal promoDiscount, BigDecimal deliveryFee, boolean deliveryWaived, BigDecimal toFree,
            BigDecimal total, PromoEngine.Auto auto) {
    }

    /** {@code missing}: indexes of lines whose variant is gone; {@code short}: index → stock. */
    public record Priced(FulfilmentMethod method, String district, List<Shop> shops, PromoEngine.Result promo,
            List<Integer> missing, Map<Integer, Integer> shortOf) {

        public BigDecimal subtotal() {
            return sum(Shop::subtotal);
        }

        public BigDecimal discount() {
            return sum(Shop::discount);
        }

        public BigDecimal promoDiscount() {
            return sum(Shop::promoDiscount);
        }

        public BigDecimal deliveryFee() {
            return sum(Shop::deliveryFee);
        }

        public BigDecimal total() {
            return sum(Shop::total);
        }

        public int count() {
            return shops.stream().flatMap(s -> s.lines().stream()).mapToInt(Line::qty).sum();
        }

        private BigDecimal sum(java.util.function.Function<Shop, BigDecimal> f) {
            return Money.usd(shops.stream().map(f).reduce(BigDecimal.ZERO, BigDecimal::add));
        }
    }

    private CheckoutPricer() {
    }

    /** {@code promotion} null with a code = unknown code; null without a code = no promo. */
    public static Priced price(List<Input> inputs, FulfilmentMethod method, String district, String promoCode,
            Promotion promotion, Instant now) {
        return price(inputs, method, district, promoCode, promotion, Map.of(), now);
    }

    /** {@code automatic}: each shop's active automatic promotions. */
    public static Priced price(List<Input> inputs, FulfilmentMethod method, String district, String promoCode,
            Promotion promotion, Map<UUID, List<Promotion>> automatic, Instant now) {
        List<Integer> missing = new ArrayList<>();
        Map<Integer, Integer> shortOf = new LinkedHashMap<>();
        // Same variant twice: one line (first index), quantities added.
        Map<UUID, Input> merged = new LinkedHashMap<>();
        for (Input in : inputs) {
            if (in.variant() == null) {
                missing.add(in.index());
                continue;
            }
            merged.merge(in.variantId(), in, (a, b) -> new Input(a.index(), a.variantId(), a.qty() + b.qty(),
                    a.variant(), a.product(), a.shop()));
        }
        Map<UUID, List<Line>> byShop = new LinkedHashMap<>();
        for (Input in : merged.values()) {
            ProductVariant v = in.variant();
            BigDecimal unit = Money.usd(v.getPrice());
            BigDecimal list = v.getCompareAt() != null && v.getCompareAt().compareTo(unit) > 0
                    ? Money.usd(v.getCompareAt()) : unit;
            if (v.getStock() < in.qty()) {
                shortOf.put(in.index(), v.getStock());
            }
            byShop.computeIfAbsent(in.shop().getId(), k -> new ArrayList<>())
                    .add(new Line(in.index(), v, in.product(), in.shop(), in.qty(), list, unit));
        }
        List<PromoEngine.PromoLine> promoLines = new ArrayList<>();
        byShop.values().forEach(ls -> ls.forEach(l -> promoLines.add(new PromoEngine.PromoLine(
                l.shop().getId(), l.product().getId(), l.product().getSlug(), l.product().getCategoryId(),
                l.product().getCollectionId(), Money.usd(l.netTotal())))));
        PromoEngine.Result promo = promoCode == null || promoCode.isBlank() ? null
                : PromoEngine.evaluate(promotion, promoLines, now);
        List<Shop> shops = new ArrayList<>();
        for (List<Line> ls : byShop.values()) {
            Business b = ls.get(0).shop();
            ProductSettings ps = b.getProductSettings();
            BigDecimal subtotal = Money.usd(ls.stream().map(Line::listTotal).reduce(BigDecimal.ZERO, BigDecimal::add));
            BigDecimal net = Money.usd(ls.stream().map(Line::netTotal).reduce(BigDecimal.ZERO, BigDecimal::add));
            BigDecimal discount = Money.usd(subtotal.subtract(net));
            boolean applied = promo != null && promo.applied();
            BigDecimal promoDisc = applied ? promo.shareOf(b.getId()) : Money.ZERO;
            boolean waived = applied && promo.freeShippingShops().contains(b.getId())
                    && method == FulfilmentMethod.DELIVERY;
            BigDecimal fullFee = DeliveryFees.fee(ps, district, net, method);
            List<PromoEngine.PromoLine> mine = promoLines.stream().filter(x -> x.businessId().equals(b.getId()))
                    .toList();
            PromoEngine.Auto auto = PromoEngine.bestAutomatic(automatic.getOrDefault(b.getId(), List.of()), mine,
                    waived || method != FulfilmentMethod.DELIVERY ? Money.ZERO : fullFee, now);
            if (auto != null) {
                // Never more than what is left to pay for the goods.
                BigDecimal room = net.subtract(promoDisc).max(BigDecimal.ZERO);
                auto = new PromoEngine.Auto(auto.promotion(), Money.usd(auto.discount().min(room)), auto.freeShipping());
                promoDisc = Money.usd(promoDisc.add(auto.discount()));
                waived = waived || auto.freeShipping();
            }
            BigDecimal fee = waived ? Money.ZERO : fullFee;
            BigDecimal toFree = method == FulfilmentMethod.PICKUP ? Money.ZERO : DeliveryFees.toFree(ps, net);
            BigDecimal total = Money.usd(subtotal.subtract(discount).subtract(promoDisc).add(fee));
            shops.add(new Shop(b, ls, subtotal, discount, promoDisc, fee, waived, toFree, total, auto));
        }
        return new Priced(method, district, shops, promo, missing, shortOf);
    }
}
