package com.kosign.vbiz.catalog.service;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.service.WorkspaceAccess;
import com.kosign.vbiz.business.service.WorkspaceAccess.Workspace;
import com.kosign.vbiz.catalog.domain.Collection;
import com.kosign.vbiz.catalog.payload.CollectionResponse;
import com.kosign.vbiz.catalog.repository.CollectionRepository;
import com.kosign.vbiz.catalog.repository.ProductRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

import lombok.RequiredArgsConstructor;

/**
 * A product shop's collections (docs/api/phase12-catalog-structure.md): listed with product
 * counts, created, renamed, reordered and deleted by the owner or a manager. A shop's first look
 * stores the starters for its category ({@link CatalogStarters}).
 */
@Service
@RequiredArgsConstructor
public class CollectionService {

    private final WorkspaceAccess access;
    private final CollectionRepository collections;
    private final ProductRepository products;

    @Transactional
    public List<CollectionResponse> list() {
        Workspace w = access.member();
        WorkspaceAccess.requireType(w, BusinessType.PRODUCT);
        return views(seeded(w));
    }

    @Transactional
    public List<CollectionResponse> create(String rawName) {
        Workspace w = manager();
        seeded(w);
        String name = name(rawName);
        if (collections.findByName(w.businessId(), name).isPresent()) {
            throw BusinessException.withDetail(StatusCode.CONFLICT, "name", "A collection with this name exists");
        }
        Collection c = new Collection();
        c.setBusinessId(w.businessId());
        c.setName(name);
        c.setPosition(collections.maxPosition(w.businessId()) + 1);
        collections.saveAndFlush(c);
        return views(ordered(w));
    }

    @Transactional
    public List<CollectionResponse> rename(UUID id, String rawName) {
        Workspace w = manager();
        Collection c = require(w, id);
        String name = name(rawName);
        Optional<Collection> other = collections.findByName(w.businessId(), name);
        if (other.isPresent() && !other.get().getId().equals(id)) {
            throw BusinessException.withDetail(StatusCode.CONFLICT, "name", "A collection with this name exists");
        }
        c.setName(name);
        collections.saveAndFlush(c);
        return views(ordered(w));
    }

    /** Deletes it; its products move to {@code moveTo} (a collection of this shop) or to none. */
    @Transactional
    public List<CollectionResponse> delete(UUID id, UUID moveTo) {
        Workspace w = manager();
        Collection c = require(w, id);
        if (moveTo != null && (moveTo.equals(id) || require(w, moveTo) == null)) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "moveTo", "Another collection");
        }
        products.moveCollection(w.businessId(), id, moveTo);
        collections.delete(c);
        collections.flush();
        return views(ordered(w));
    }

    /** {@code ids}: every collection of the shop, in the new order. */
    @Transactional
    public List<CollectionResponse> reorder(List<UUID> ids) {
        Workspace w = manager();
        List<Collection> all = ordered(w);
        if (ids == null || ids.size() != all.size()
                || !new HashSet<>(ids).equals(new HashSet<>(all.stream().map(Collection::getId).toList()))) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "ids", "Every collection id, once");
        }
        Map<UUID, Collection> byId = new HashMap<>();
        all.forEach(c -> byId.put(c.getId(), c));
        for (int i = 0; i < ids.size(); i++) {
            byId.get(ids.get(i)).setPosition(i);
        }
        collections.saveAllAndFlush(all);
        return views(ordered(w));
    }

    /**
     * The collection named {@code name} (case-insensitive), created when new; used by the product
     * editor, which picks a collection by name.
     */
    @Transactional
    public UUID idForName(Workspace w, String name) {
        seeded(w);
        return collections.findByName(w.businessId(), name).map(Collection::getId).orElseGet(() -> {
            Collection c = new Collection();
            c.setBusinessId(w.businessId());
            c.setName(name(name));
            c.setPosition(collections.maxPosition(w.businessId()) + 1);
            return collections.saveAndFlush(c).getId();
        });
    }

    /** The shop's collections, storing its category's starters the first time. */
    private List<Collection> seeded(Workspace w) {
        List<Collection> cs = ordered(w);
        if (!cs.isEmpty() || products.existsByBusinessIdAndCollectionIdIsNotNull(w.businessId())) {
            return cs;
        }
        List<String> starters = CatalogStarters.collections(w.business().getCategoryId());
        for (int i = 0; i < starters.size(); i++) {
            Collection c = new Collection();
            c.setBusinessId(w.businessId());
            c.setName(starters.get(i));
            c.setPosition(i);
            collections.save(c);
        }
        collections.flush();
        return ordered(w);
    }

    private List<Collection> ordered(Workspace w) {
        return collections.findByBusinessIdOrderByPositionAscNameAsc(w.businessId());
    }

    private List<CollectionResponse> views(List<Collection> cs) {
        if (cs.isEmpty()) {
            return List.of();
        }
        Map<UUID, Long> counts = new HashMap<>();
        products.countByCollection(cs.get(0).getBusinessId()).forEach(r -> counts.put((UUID) r[0], (Long) r[1]));
        return cs.stream().map(c -> new CollectionResponse(c.getId().toString(), c.getName(),
                counts.getOrDefault(c.getId(), 0L))).toList();
    }

    private Workspace manager() {
        Workspace w = access.manager();
        WorkspaceAccess.requireType(w, BusinessType.PRODUCT);
        return w;
    }

    private Collection require(Workspace w, UUID id) {
        return collections.findById(id).filter(c -> c.getBusinessId().equals(w.businessId()))
                .orElseThrow(() -> new BusinessException(StatusCode.NOT_FOUND));
    }

    private static String name(String raw) {
        String n = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        if (n.length() < 2 || n.length() > 40) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "name", "2–40 characters");
        }
        return n;
    }
}
