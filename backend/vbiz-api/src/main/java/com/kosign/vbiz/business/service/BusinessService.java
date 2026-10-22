package com.kosign.vbiz.business.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.kosign.vbiz.activity.service.ShopActivityLog;
import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.service.UserService;
import com.kosign.vbiz.business.domain.BookingSettings;
import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.domain.BusinessDocument;
import com.kosign.vbiz.business.domain.BusinessMember;
import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.domain.DeliveryZone;
import com.kosign.vbiz.business.domain.MemberRole;
import com.kosign.vbiz.business.domain.ProductSettings;
import com.kosign.vbiz.business.domain.ShopPolicy;
import com.kosign.vbiz.business.domain.VerificationStatus;
import com.kosign.vbiz.business.mapper.BusinessMapper;
import com.kosign.vbiz.business.payload.BusinessResponse;
import com.kosign.vbiz.business.payload.CreateBusinessRequest;
import com.kosign.vbiz.business.payload.MemberInput;
import com.kosign.vbiz.business.payload.MemberResponse;
import com.kosign.vbiz.business.payload.MyBusinessResponse;
import com.kosign.vbiz.business.payload.UpdateBusinessRequest;
import com.kosign.vbiz.business.repository.BusinessDocumentRepository;
import com.kosign.vbiz.business.repository.BusinessMemberRepository;
import com.kosign.vbiz.business.repository.BusinessRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.helper.Emails;
import com.kosign.vbiz.common.helper.Money;
import com.kosign.vbiz.common.helper.PhoneNumbers;
import com.kosign.vbiz.common.tenancy.TenantContext;
import com.kosign.vbiz.meta.service.ReferenceDataService;

import com.kosign.vbiz.storage.domain.FilePurpose;
import com.kosign.vbiz.storage.service.StorageService;

import lombok.RequiredArgsConstructor;

/** Create Business, the user's businesses, and business settings. */
@Service
@RequiredArgsConstructor
public class BusinessService {

    private final ShopActivityLog activity;
    private final BusinessRepository businesses;
    private final BusinessMemberRepository members;
    private final BusinessDocumentRepository documents;
    private final MembershipService membership;
    private final StorageService storage;
    private final UserService users;
    private final ReferenceDataService reference;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    /**
     * Creates the business with the caller as OWNER. Verification starts PENDING; settings get
     * the Create Business defaults; the slug is unique ({@code -2}, {@code -3}, … on collision).
     */
    @Transactional
    public BusinessResponse create(UUID userId, CreateBusinessRequest req) {
        User owner = users.require(userId);
        Business b = new Business();
        b.setOwnerId(userId);
        b.setType(req.type());
        b.setName(req.name().trim());
        b.setSlug(uniqueSlug(BusinessRules.slugify(req.name())));
        b.setCategoryId(reference.requireCategory(req.categoryId(), req.type()));
        b.setDistrict(reference.canonicalDistrict(req.district()));
        b.setStreet(req.street().trim());
        setPin(b, req.lat(), req.lng());
        b.setPhone(PhoneNumbers.normalizeOrThrow(req.phone()));
        b.setHours(BusinessRules.weekFromForm(req.hours().open(), req.hours().close(), req.hours().sunday()));
        b.setBakongId(req.bakongId() == null || req.bakongId().isBlank() ? null : BusinessRules.bakongId(req.bakongId()));
        b.setOnline(true);
        b.setVerification(VerificationStatus.PENDING);
        b.setSince(clock.instant());
        if (req.type() == BusinessType.PRODUCT) {
            b.setProductSettings(ProductSettings.defaults());
        } else {
            b.setBookingSettings(BookingSettings.defaults());
        }
        BusinessRules.DataUrl photo = req.idPhoto() == null || req.idPhoto().isBlank()
                ? null : BusinessRules.decodeIdPhoto(req.idPhoto());
        businesses.saveAndFlush(b);

        BusinessMember m = new BusinessMember();
        m.setBusinessId(b.getId());
        m.setUserId(userId);
        m.setName(owner.getName());
        m.setRole(MemberRole.OWNER);
        m.setTitle("Owner");
        m.setActive(true);
        members.save(m);

        if (photo != null) {
            BusinessDocument doc = new BusinessDocument();
            doc.setBusinessId(b.getId());
            doc.setKind(BusinessDocument.ID_PHOTO);
            doc.setContentType(photo.contentType());
            doc.setSizeBytes(photo.bytes().length);
            doc.setData(photo.bytes());
            documents.save(doc);
        }
        return BusinessMapper.toResponse(b);
    }

    /** A new ID photo replaces the old one and puts the shop back in the verification queue. */
    private void resubmitId(Business b, BusinessRules.DataUrl photo) {
        if (b.getVerification() == VerificationStatus.VERIFIED) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "idPhoto", "The ID is already verified");
        }
        documents.deleteByBusinessIdAndKind(b.getId(), BusinessDocument.ID_PHOTO);
        BusinessDocument doc = new BusinessDocument();
        doc.setBusinessId(b.getId());
        doc.setKind(BusinessDocument.ID_PHOTO);
        doc.setContentType(photo.contentType());
        doc.setSizeBytes(photo.bytes().length);
        doc.setData(photo.bytes());
        documents.save(doc);
        b.setVerification(VerificationStatus.PENDING);
        b.setVerificationNote(null);
        b.setVerifiedAt(null);
        b.setVerifiedBy(null);
    }

    @Transactional(readOnly = true)
    public List<MyBusinessResponse> mine(UUID userId) {
        return members.findMembershipsOfUser(userId).stream()
                .map(row -> BusinessMapper.toMine((BusinessMember) row[0], (Business) row[1]))
                .toList();
    }

    /** Any active member. {@code BUSINESS_NOT_FOUND}, or {@code FORBIDDEN_TENANT} for non-members. */
    @Transactional(readOnly = true)
    public BusinessResponse get(UUID userId, UUID businessId) {
        Business b = require(businessId);
        requireMember(userId, businessId);
        return BusinessMapper.toResponse(b);
    }

    /** Staff list of a business (any member), with each login's email. */
    @Transactional(readOnly = true)
    public List<MemberResponse> members(UUID userId, UUID businessId) {
        require(businessId);
        requireMember(userId, businessId);
        List<BusinessMember> list = membership.members(businessId);
        Map<UUID, String> emails = users.findAllById(list.stream().map(BusinessMember::getUserId)
                .filter(java.util.Objects::nonNull).toList()).stream()
                .filter(u -> u.getEmail() != null)
                .collect(java.util.stream.Collectors.toMap(User::getId, User::getEmail));
        return list.stream().map(m -> BusinessMapper.toMember(m, m.getUserId() == null ? null
                : emails.get(m.getUserId()))).toList();
    }

    /** A staff member without an account (Team page). Owner or manager. */
    @Transactional
    public MemberResponse addMember(UUID userId, UUID businessId, MemberInput in) {
        require(businessId);
        requireManager(userId, businessId);
        BusinessMember m = new BusinessMember();
        m.setBusinessId(businessId);
        m.setRole(MemberRole.STAFF);
        m.setName(memberName(in.name()));
        applyMember(m, in);
        BusinessMember saved = members.saveAndFlush(m);
        BusinessMember me = requireMember(userId, businessId);
        activity.record(businessId, userId, me.getName(), ShopActivityLog.TEAM_ADDED, "MEMBER", saved.getId(),
                saved.getName(), Map.of("role", saved.getRole().name()));
        return BusinessMapper.toMember(saved);
    }

    /**
     * Name, title, colour, shifts, active, role (docs/api/phase10-shop-team.md § Permissions). The
     * owner changes anyone but themself-as-owner; a manager changes staff only (and their own
     * details); only the owner sets roles, never to OWNER. The owner stays active.
     */
    @Transactional
    public MemberResponse updateMember(UUID userId, UUID businessId, UUID memberId, MemberInput in) {
        require(businessId);
        BusinessMember me = requireMember(userId, businessId);
        if (me.getRole() == MemberRole.STAFF) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
        BusinessMember m = members.findById(memberId).filter(x -> x.getBusinessId().equals(businessId))
                .orElseThrow(() -> new BusinessException(StatusCode.NOT_FOUND));
        boolean self = m.getId().equals(me.getId());
        if (me.getRole() == MemberRole.MANAGER && m.getRole() != MemberRole.STAFF && !self) {
            throw BusinessException.withDetail(StatusCode.FORBIDDEN, "memberId", "Managers change staff only");
        }
        MemberRole roleBefore = m.getRole();
        boolean activeBefore = m.isActive();
        if (in.role() != null && in.role() != m.getRole()) {
            if (me.getRole() != MemberRole.OWNER) {
                throw BusinessException.withDetail(StatusCode.FORBIDDEN, "role", "Only the owner sets roles");
            }
            if (in.role() == MemberRole.OWNER || m.getRole() == MemberRole.OWNER) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "role",
                        "A shop has one owner; roles are MANAGER or STAFF");
            }
            m.setRole(in.role());
        }
        if (in.name() != null) {
            m.setName(memberName(in.name()));
        }
        if (Boolean.FALSE.equals(in.active()) && (m.getRole() == MemberRole.OWNER || self)) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "active",
                    m.getRole() == MemberRole.OWNER ? "The owner stays active" : "You can't remove yourself");
        }
        applyMember(m, in);
        BusinessMember saved = members.saveAndFlush(m);
        if (saved.getRole() != roleBefore) {
            activity.record(businessId, userId, me.getName(), ShopActivityLog.TEAM_ROLE_CHANGED, "MEMBER",
                    saved.getId(), saved.getName(), Map.of("from", roleBefore.name(), "to", saved.getRole().name()));
        }
        if (saved.isActive() != activeBefore) {
            activity.record(businessId, userId, me.getName(),
                    saved.isActive() ? ShopActivityLog.TEAM_RESTORED : ShopActivityLog.TEAM_REMOVED, "MEMBER",
                    saved.getId(), saved.getName(), Map.of());
        }
        return BusinessMapper.toMember(saved);
    }

    /** Owner or manager. Staff get {@code FORBIDDEN}. */
    @Transactional
    public BusinessResponse update(UUID userId, UUID businessId, UpdateBusinessRequest req) {
        Business b = require(businessId);
        BusinessMember m = requireMember(userId, businessId);
        if (m.getRole() == MemberRole.STAFF) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
        if (req.name() != null) {
            String name = req.name().trim();
            if (name.length() < 2) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "name", "Name is too short");
            }
            b.setName(name);
        }
        if (req.categoryId() != null) {
            b.setCategoryId(reference.requireCategory(req.categoryId(), b.getType()));
        }
        if (req.about() != null) {
            b.setAbout(req.about().isBlank() ? null : req.about().trim());
        }
        if (req.phone() != null) {
            b.setPhone(PhoneNumbers.normalizeOrThrow(req.phone()));
        }
        if (req.email() != null) {
            b.setEmail(req.email().isBlank() ? null : Emails.normalizeOrThrow(req.email(), "email"));
        }
        if (req.district() != null) {
            b.setDistrict(reference.canonicalDistrict(req.district()));
        }
        if (req.street() != null) {
            b.setStreet(req.street().trim());
        }
        if (req.lat() != null || req.lng() != null) {
            setPin(b, req.lat(), req.lng());
        }
        if (req.hours() != null && !req.hours().isNull()) {
            b.setHours(BusinessRules.weekFromJson(req.hours()));
        }
        if (req.closures() != null) {
            b.setClosures(BusinessRules.closures(req.closures()));
        }
        if (req.online() != null) {
            b.setOnline(req.online());
        }
        if (req.bakongId() != null) {
            String next = req.bakongId().isBlank() ? null : BusinessRules.bakongId(req.bakongId());
            // Where the shop's money goes: the owner's call only.
            if (!java.util.Objects.equals(next, b.getBakongId()) && m.getRole() != MemberRole.OWNER) {
                throw BusinessException.withDetail(StatusCode.FORBIDDEN, "bakongId",
                        "Only the owner changes the payout account");
            }
            b.setBakongId(next);
        }
        if (req.logoUrl() != null) {
            b.setLogoUrl(storage.requireOwnImage(req.logoUrl(), userId, "logoUrl", Set.of(FilePurpose.BUSINESS_LOGO)));
        }
        if (req.coverUrl() != null) {
            b.setCoverUrl(storage.requireOwnImage(req.coverUrl(), userId, "coverUrl", Set.of(FilePurpose.BUSINESS_COVER)));
        }
        if (req.idPhoto() != null && !req.idPhoto().isBlank()) {
            resubmitId(b, BusinessRules.decodeIdPhoto(req.idPhoto()));
        }
        if (req.productSettings() != null && !req.productSettings().isNull()) {
            if (b.getType() != BusinessType.PRODUCT) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "productSettings",
                        "Only product businesses have product settings");
            }
            b.setProductSettings(validate(merge(b.getProductSettings(), req.productSettings(),
                    ProductSettings.class, "productSettings")));
        }
        if (req.bookingSettings() != null && !req.bookingSettings().isNull()) {
            if (b.getType() != BusinessType.SERVICE) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "bookingSettings",
                        "Only service businesses have booking settings");
            }
            b.setBookingSettings(validate(merge(b.getBookingSettings(), req.bookingSettings(),
                    BookingSettings.class, "bookingSettings")));
        }
        if (req.policy() != null && !req.policy().isNull()) {
            b.setPolicy(validate(merge(b.getPolicy(), req.policy(), ShopPolicy.class, "policy")));
        }
        Business saved = businesses.saveAndFlush(b);
        activity.record(businessId, userId, m.getName(), ShopActivityLog.SETTINGS_CHANGED, "SHOP", businessId,
                saved.getName(), Map.of("fields", ShopActivityLog.sentFields(req)));
        return BusinessMapper.toResponse(saved);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────────

    private void requireManager(UUID userId, UUID businessId) {
        if (requireMember(userId, businessId).getRole() == MemberRole.STAFF) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
    }

    private static void applyMember(BusinessMember m, MemberInput in) {
        if (in.title() != null) {
            m.setTitle(in.title().isBlank() ? null : in.title().trim());
        }
        if (in.color() != null) {
            m.setColor(in.color().toUpperCase(java.util.Locale.ROOT));
        }
        if (in.shifts() != null) {
            m.setShifts(in.shifts().isNull() ? null : BusinessRules.weekFromJson(in.shifts(), "shifts"));
        }
        if (in.active() != null) {
            m.setActive(in.active());
        }
    }

    private static String memberName(String raw) {
        String name = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        if (name.length() < 2 || name.length() > 80) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "name", "2–80 characters");
        }
        return name;
    }

    private Business require(UUID id) {
        return businesses.findById(id).orElseThrow(() -> new BusinessException(StatusCode.BUSINESS_NOT_FOUND));
    }

    /** The caller's membership; also rejects an {@code X-Business-Id} that names another business. */
    private BusinessMember requireMember(UUID userId, UUID businessId) {
        TenantContext.getBusinessId().ifPresent(tenant -> {
            if (!tenant.equals(businessId)) {
                throw new BusinessException(StatusCode.FORBIDDEN_TENANT);
            }
        });
        return membership.membership(userId, businessId)
                .orElseThrow(() -> new BusinessException(StatusCode.FORBIDDEN_TENANT));
    }

    private String uniqueSlug(String base) {
        if (!businesses.existsBySlug(base)) {
            return base;
        }
        for (int n = 2; ; n++) {
            String candidate = base + "-" + n;
            if (!businesses.existsBySlug(candidate)) {
                return candidate;
            }
        }
    }

    private static void setPin(Business b, BigDecimal lat, BigDecimal lng) {
        if ((lat == null) != (lng == null)) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "lat", "lat and lng go together");
        }
        b.setLat(lat == null ? null : lat.setScale(6, RoundingMode.HALF_UP));
        b.setLng(lng == null ? null : lng.setScale(6, RoundingMode.HALF_UP));
    }

    /** Shallow merge of the patch into the current settings; an explicit null clears a field. */
    private <T> T merge(T current, JsonNode patch, Class<T> type, String field) {
        if (!patch.isObject()) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, field, "Must be an object");
        }
        ObjectNode merged = current == null ? objectMapper.createObjectNode() : objectMapper.valueToTree(current);
        merged.setAll((ObjectNode) patch);
        try {
            return objectMapper.treeToValue(merged, type);
        } catch (JsonProcessingException | IllegalArgumentException ex) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, field, "Invalid settings");
        }
    }

    private static ProductSettings validate(ProductSettings s) {
        requireAll("productSettings", "autoAccept", s.autoAccept(), "prepMinutes", s.prepMinutes(),
                "lowStockDefault", s.lowStockDefault(), "pickup", s.pickup(), "cod", s.cod(), "zones", s.zones());
        range("productSettings.prepMinutes", s.prepMinutes(), 0, 24 * 60);
        range("productSettings.lowStockDefault", s.lowStockDefault(), 0, 100_000);
        BigDecimal free = null;
        if (s.freeDeliveryOver() != null) {
            if (s.freeDeliveryOver().signum() < 0) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "productSettings.freeDeliveryOver",
                        "Must not be negative");
            }
            free = Money.usd(s.freeDeliveryOver());
        }
        List<DeliveryZone> zones = s.zones().stream().map(z -> {
            if (z == null || z.label() == null || z.label().isBlank() || z.districts() == null
                    || z.fee() == null || z.fee().signum() < 0) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "productSettings.zones",
                        "Each zone needs a label, districts and a fee of 0 or more");
            }
            return new DeliveryZone(z.label().trim(), List.copyOf(z.districts()), Money.usd(z.fee()));
        }).toList();
        if (s.returnDays() != null) {
            range("productSettings.returnDays", s.returnDays(), 0, 30);
        }
        return new ProductSettings(s.autoAccept(), s.prepMinutes(), s.lowStockDefault(), s.pickup(), s.cod(),
                free, zones, s.returnDays());
    }

    private static BookingSettings validate(BookingSettings input) {
        BookingSettings s = input;
        requireAll("bookingSettings", "onlineBooking", s.onlineBooking(), "autoConfirm", s.autoConfirm(),
                "reminderHours", s.reminderHours(), "minNoticeHours", s.minNoticeHours(),
                "freeCancelHours", s.freeCancelHours(), "bufferMinutes", s.bufferMinutes());
        range("bookingSettings.reminderHours", s.reminderHours(), 0, 168);
        range("bookingSettings.minNoticeHours", s.minNoticeHours(), 0, 168);
        range("bookingSettings.freeCancelHours", s.freeCancelHours(), 0, 168);
        range("bookingSettings.bufferMinutes", s.bufferMinutes(), 0, 240);
        if (s.slotMinutes() != null && !List.of(5, 10, 15, 20, 30, 45, 60).contains(s.slotMinutes())) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "bookingSettings.slotMinutes",
                    "5, 10, 15, 20, 30, 45 or 60");
        }
        if (s.maxDaysAhead() != null) {
            range("bookingSettings.maxDaysAhead", s.maxDaysAhead(), 1, 180);
        }
        if (s.serviceCategories() != null) {
            List<String> cats = s.serviceCategories().stream().map(c -> c == null ? "" : c.trim()).toList();
            if (cats.size() > 20 || cats.stream().anyMatch(c -> c.isEmpty() || c.length() > 40)
                    || cats.stream().map(c -> c.toLowerCase(java.util.Locale.ROOT)).distinct().count() != cats.size()) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "bookingSettings.serviceCategories",
                        "Up to 20 different names, 1–40 characters each");
            }
            s = new BookingSettings(s.onlineBooking(), s.autoConfirm(), s.reminderHours(), s.minNoticeHours(),
                    s.freeCancelHours(), s.bufferMinutes(), s.slotMinutes(), s.maxDaysAhead(), s.tipPresets(), cats);
        }
        if (s.tipPresets() != null) {
            if (s.tipPresets().size() > 5 || s.tipPresets().stream().anyMatch(p -> p == null || p < 0 || p > 50)) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "bookingSettings.tipPresets",
                        "Up to 5 percentages, each 0–50");
            }
        }
        return s;
    }

    private static final java.util.regex.Pattern TAX_ID = java.util.regex.Pattern.compile("^[A-Za-z0-9-]{4,20}$");

    /** Receipt text up to 120 / 300 characters, VAT 0–20 %, links up to 200 characters. */
    private static ShopPolicy validate(ShopPolicy p) {
        String header = text(p.receiptHeader(), 120, "policy.receiptHeader");
        String footer = text(p.receiptFooter(), 300, "policy.receiptFooter");
        BigDecimal tax = p.taxPct() == null ? BigDecimal.ZERO : p.taxPct();
        if (tax.signum() < 0 || tax.compareTo(BigDecimal.valueOf(20)) > 0 || tax.stripTrailingZeros().scale() > 2) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "policy.taxPct", "0–20, up to 2 decimals");
        }
        String taxId = text(p.taxId(), 20, "policy.taxId");
        if (taxId != null && !TAX_ID.matcher(taxId).matches()) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "policy.taxId", "Letters, digits and -");
        }
        if (Boolean.FALSE.equals(p.payCash()) && Boolean.FALSE.equals(p.payKhqr()) && Boolean.FALSE.equals(p.payCard())) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "policy.payCash",
                    "Accept at least one payment method");
        }
        return new ShopPolicy(header, footer, tax, taxId, p.payCash(), p.payKhqr(), p.payCard(),
                text(p.facebook(), 200, "policy.facebook"), text(p.telegram(), 200, "policy.telegram"),
                text(p.instagram(), 200, "policy.instagram"), text(p.tiktok(), 200, "policy.tiktok"),
                text(p.website(), 200, "policy.website"));
    }

    private static String text(String v, int max, String field) {
        if (v == null || v.isBlank()) {
            return null;
        }
        String t = v.trim();
        if (t.length() > max) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, field, "Up to " + max + " characters");
        }
        return t;
    }

    /** {@code keyValues} = name, value, name, value, … */
    private static void requireAll(String prefix, Object... keyValues) {
        for (int i = 0; i < keyValues.length; i += 2) {
            if (keyValues[i + 1] == null) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, prefix + "." + keyValues[i], "Required");
            }
        }
    }

    private static void range(String field, int v, int min, int max) {
        if (v < min || v > max) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, field,
                    "Must be between " + min + " and " + max);
        }
    }
}
