package com.kosign.vbiz.cart.service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.domain.VerificationStatus;
import com.kosign.vbiz.business.repository.BusinessRepository;
import com.kosign.vbiz.cart.domain.CartLine;
import com.kosign.vbiz.cart.payload.CartInput;
import com.kosign.vbiz.cart.payload.CartResponse;
import com.kosign.vbiz.cart.repository.CartLineRepository;
import com.kosign.vbiz.catalog.domain.Product;
import com.kosign.vbiz.catalog.domain.ProductStatus;
import com.kosign.vbiz.catalog.domain.ProductVariant;
import com.kosign.vbiz.catalog.mapper.CatalogMapper;
import com.kosign.vbiz.catalog.repository.ProductRepository;
import com.kosign.vbiz.catalog.repository.ProductVariantRepository;

import lombok.RequiredArgsConstructor;

/**
 * The signed-in customer's cart (docs/api/phase3-orders-checkout.md § Cart). Lines whose variant
 * is gone or no longer listed are dropped silently, so a stale browser cart never blocks the sync.
 */
@Service
@RequiredArgsConstructor
public class CartService {

    private final CartLineRepository lines;
    private final ProductVariantRepository variants;
    private final ProductRepository products;
    private final BusinessRepository businesses;

    /** A variant the customer may buy, with its product and shop. */
    private record Listed(ProductVariant variant, Product product, Business shop) {
    }

    @Transactional(readOnly = true)
    public CartResponse get(UUID userId) {
        List<CartLine> rows = lines.findOfUser(userId);
        Map<UUID, Listed> listed = listed(rows.stream().map(CartLine::getVariantId).toList());
        return toResponse(rows, listed);
    }

    @Transactional
    public CartResponse replace(UUID userId, CartInput in) {
        Map<UUID, Listed> listed = listed(ids(in));
        lines.deleteOfUser(userId);
        List<CartLine> saved = new ArrayList<>();
        saved.addAll(store(userId, merged(in.lines()), false, listed));
        saved.addAll(store(userId, merged(in.laterOrEmpty()), true, listed));
        return toResponse(saved, listed);
    }

    /** Adds the guest cart: same variant → quantities add up (capped at the stock, at least 1). */
    @Transactional
    public CartResponse merge(UUID userId, CartInput in) {
        List<CartLine> current = lines.findOfUser(userId);
        Set<UUID> all = new HashSet<>(ids(in));
        current.forEach(l -> all.add(l.getVariantId()));
        Map<UUID, Listed> listed = listed(all);
        Map<UUID, CartInput.Line> cart = new LinkedHashMap<>();
        Map<UUID, CartInput.Line> later = new LinkedHashMap<>();
        for (CartLine l : current) {
            (l.isSavedForLater() ? later : cart).put(l.getVariantId(),
                    new CartInput.Line(l.getVariantId(), l.getQty(), l.isSelected()));
        }
        for (CartInput.Line g : merged(in.lines())) {
            Listed x = listed.get(g.variantId());
            if (x == null) {
                continue;
            }
            CartInput.Line had = cart.get(g.variantId());
            int qty = (had == null ? 0 : had.qty()) + g.qty();
            int cap = Math.max(1, x.variant().getStock());
            cart.put(g.variantId(), new CartInput.Line(g.variantId(), Math.min(Math.min(qty, cap), 999), true));
        }
        for (CartInput.Line g : merged(in.laterOrEmpty())) {
            later.putIfAbsent(g.variantId(), g);
        }
        lines.deleteOfUser(userId);
        List<CartLine> saved = new ArrayList<>();
        saved.addAll(store(userId, new ArrayList<>(cart.values()), false, listed));
        saved.addAll(store(userId, new ArrayList<>(later.values()), true, listed));
        return toResponse(saved, listed);
    }

    /** After a checkout: the placed variants leave the cart. */
    @Transactional
    public void removePlaced(UUID userId, Collection<UUID> variantIds) {
        if (!variantIds.isEmpty()) {
            lines.deleteLines(userId, variantIds);
        }
    }

    private List<CartLine> store(UUID userId, List<CartInput.Line> in, boolean later, Map<UUID, Listed> listed) {
        List<CartLine> out = new ArrayList<>();
        int pos = 0;
        for (CartInput.Line l : in) {
            if (!listed.containsKey(l.variantId())) {
                continue;
            }
            CartLine row = new CartLine();
            row.setUserId(userId);
            row.setVariantId(l.variantId());
            row.setQty(l.qty());
            row.setSelected(later || l.selected() == null || l.selected());
            row.setSavedForLater(later);
            row.setPosition(pos++);
            out.add(row);
        }
        return lines.saveAll(out);
    }

    /** The same variant twice in one list becomes one line (quantities added, max 999). */
    private static List<CartInput.Line> merged(List<CartInput.Line> in) {
        Map<UUID, CartInput.Line> m = new LinkedHashMap<>();
        for (CartInput.Line l : in) {
            m.merge(l.variantId(), l, (a, b) -> new CartInput.Line(a.variantId(), Math.min(999, a.qty() + b.qty()),
                    a.selected() == null || a.selected() || b.selected() == null || b.selected()));
        }
        return new ArrayList<>(m.values());
    }

    private static List<UUID> ids(CartInput in) {
        List<UUID> out = new ArrayList<>();
        in.lines().forEach(l -> out.add(l.variantId()));
        in.laterOrEmpty().forEach(l -> out.add(l.variantId()));
        return out;
    }

    /** Variants that are live, of an ACTIVE live product, of an online product shop. */
    private Map<UUID, Listed> listed(Collection<UUID> variantIds) {
        if (variantIds.isEmpty()) {
            return Map.of();
        }
        List<ProductVariant> vs = variants.findAllById(new HashSet<>(variantIds)).stream()
                .filter(v -> v.getDeletedAt() == null).toList();
        Map<UUID, Product> ps = products.findAllById(vs.stream().map(ProductVariant::getProductId)
                .collect(Collectors.toSet())).stream()
                .filter(p -> p.getDeletedAt() == null && p.getStatus() == ProductStatus.ACTIVE)
                .collect(Collectors.toMap(Product::getId, Function.identity()));
        Map<UUID, Business> bs = businesses.findAllById(ps.values().stream().map(Product::getBusinessId)
                .collect(Collectors.toSet())).stream()
                .filter(b -> b.isOnline() && !b.isSuspended() && b.getType() == BusinessType.PRODUCT
                        && b.getVerification() != VerificationStatus.REJECTED)
                .collect(Collectors.toMap(Business::getId, Function.identity()));
        Map<UUID, Listed> out = new LinkedHashMap<>();
        for (ProductVariant v : vs) {
            Product p = ps.get(v.getProductId());
            Business b = p == null ? null : bs.get(p.getBusinessId());
            if (b != null) {
                out.put(v.getId(), new Listed(v, p, b));
            }
        }
        return out;
    }

    private static CartResponse toResponse(List<CartLine> rows, Map<UUID, Listed> listed) {
        List<CartResponse.Line> cart = new ArrayList<>();
        List<CartResponse.Line> later = new ArrayList<>();
        for (CartLine r : rows) {
            Listed x = listed.get(r.getVariantId());
            if (x == null) {
                continue;
            }
            CartResponse.Line line = new CartResponse.Line(x.variant().getId().toString(),
                    x.product().getId().toString(), x.product().getSlug(), x.shop().getSlug(),
                    CatalogMapper.optionMap(x.product().getOptions(), x.variant().getOptionValues()),
                    r.getQty(), r.isSelected());
            (r.isSavedForLater() ? later : cart).add(line);
        }
        return new CartResponse(cart, later);
    }
}
