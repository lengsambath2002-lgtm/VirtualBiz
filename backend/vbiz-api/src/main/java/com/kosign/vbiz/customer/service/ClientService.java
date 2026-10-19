package com.kosign.vbiz.customer.service;

import java.time.Clock;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.service.WorkspaceAccess;
import com.kosign.vbiz.business.service.WorkspaceAccess.Workspace;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.helper.Emails;
import com.kosign.vbiz.common.helper.PhoneNumbers;
import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.repository.UserRepository;
import com.kosign.vbiz.customer.domain.Client;
import com.kosign.vbiz.customer.payload.ClientInput;
import com.kosign.vbiz.customer.payload.ClientResponse;
import com.kosign.vbiz.customer.repository.ClientRepository;

import lombok.RequiredArgsConstructor;

/**
 * A service business's clients (docs/api/phase4-bookings-provider.md § Clients). Bookings find or
 * create the client through {@link #findOrCreate}; the workspace edits them through the CRUD calls.
 */
@Service
@RequiredArgsConstructor
public class ClientService {

    private final ClientRepository clients;
    private final UserRepository users;
    private final WorkspaceAccess access;
    private final Clock clock;

    @Transactional(readOnly = true)
    public List<ClientResponse> list() {
        Workspace w = access.member();
        return clients.findByBusinessIdOrderByNameAscIdAsc(w.businessId()).stream().map(ClientService::toResponse)
                .toList();
    }

    @Transactional
    public ClientResponse create(ClientInput in) {
        Workspace w = workspace();
        String name = requireName(in.name());
        String phone = PhoneNumbers.normalizeOrThrow(in.phone());
        if (clients.findByBusinessIdAndPhone(w.businessId(), phone).isPresent()) {
            throw BusinessException.withDetail(StatusCode.DUPLICATE_CLIENT, "phone", "Another client has this phone");
        }
        Client c = newClient(w.businessId(), name, phone);
        c.setEmail(email(in.email()));
        c.setNote(blankToNull(in.note()));
        return toResponse(clients.saveAndFlush(c));
    }

    @Transactional
    public ClientResponse update(UUID id, ClientInput in) {
        Workspace w = workspace();
        Client c = clients.findByIdAndBusinessId(id, w.businessId())
                .orElseThrow(() -> new BusinessException(StatusCode.CLIENT_NOT_FOUND));
        if (in.name() != null) {
            c.setName(requireName(in.name()));
        }
        if (in.phone() != null) {
            String phone = PhoneNumbers.normalizeOrThrow(in.phone());
            Optional<Client> other = clients.findByBusinessIdAndPhone(w.businessId(), phone);
            if (other.isPresent() && !other.get().getId().equals(c.getId())) {
                throw BusinessException.withDetail(StatusCode.DUPLICATE_CLIENT, "phone",
                        "Another client has this phone");
            }
            c.setPhone(phone);
        }
        if (in.email() != null) {
            c.setEmail(email(in.email()));
        }
        if (in.note() != null) {
            c.setNote(blankToNull(in.note()));
        }
        return toResponse(clients.saveAndFlush(c));
    }

    // ── For bookings and sales ────────────────────────────────────────────────────────

    /** A client of the business, or {@code CLIENT_NOT_FOUND}. */
    @Transactional(readOnly = true)
    public Client require(UUID businessId, UUID clientId) {
        return clients.findByIdAndBusinessId(clientId, businessId)
                .orElseThrow(() -> new BusinessException(StatusCode.CLIENT_NOT_FOUND));
    }

    /**
     * The client for a booking or an order: by account ({@code userId}), then by phone, else a new
     * one. An existing client keeps its name; a missing email is filled in. An account is linked
     * to a client found by phone only when that phone is the account's own: anyone can type a
     * phone number, and the client's history must not move to someone else's account.
     */
    @Transactional
    public Client findOrCreate(UUID businessId, UUID userId, String name, String rawPhone, String rawEmail) {
        String phone = PhoneNumbers.normalizeOrThrow(rawPhone);
        String email = rawEmail == null || rawEmail.isBlank() ? null : Emails.normalize(rawEmail);
        Optional<Client> mine = userId == null ? Optional.empty() : clients.findByBusinessIdAndUserId(businessId, userId);
        if (mine.isPresent()) {
            Client c = mine.get();
            if (c.getEmail() == null && email != null && Emails.isValid(email)) {
                c.setEmail(email);
            }
            return clients.save(c);
        }
        Optional<Client> byPhone = clients.findByBusinessIdAndPhone(businessId, phone);
        if (byPhone.isPresent()) {
            Client c = byPhone.get();
            boolean ownPhone = userId != null && users.findById(userId).map(User::getPhone)
                    .map(phone::equals).orElse(false);
            if (ownPhone && c.getUserId() == null) {
                c.setUserId(userId);
                if (c.getEmail() == null && email != null && Emails.isValid(email)) {
                    c.setEmail(email);
                }
            }
            return clients.save(c);
        }
        Client c = newClient(businessId, requireName(name), phone);
        c.setUserId(userId);
        if (c.getEmail() == null && email != null && Emails.isValid(email)) {
            c.setEmail(email);
        }
        return clients.save(c);
    }

    /**
     * The client for an order (product shops): by account, then phone, else new; keeps the latest
     * delivery district. Nothing when there is no valid phone to file it under.
     */
    @Transactional
    public void linkOrderCustomer(UUID businessId, UUID userId, String name, String rawPhone, String email,
            String district) {
        String phone = PhoneNumbers.normalize(rawPhone);
        if (!PhoneNumbers.isValid(phone)) {
            Optional<Client> byUser = clients.findByBusinessIdAndUserId(businessId, userId);
            byUser.ifPresent(c -> {
                if (district != null) {
                    c.setDistrict(district);
                }
            });
            return;
        }
        Client c = findOrCreate(businessId, userId, name == null || name.isBlank() ? "Customer" : name, phone, email);
        if (district != null && !district.isBlank()) {
            c.setDistrict(district);
        }
    }

    @Transactional(readOnly = true)
    public Map<UUID, Client> byIds(Collection<UUID> ids) {
        return ids.isEmpty() ? Map.of()
                : clients.findByIdIn(ids).stream().collect(Collectors.toMap(Client::getId, Function.identity()));
    }

    public static ClientResponse toResponse(Client c) {
        return new ClientResponse(c.getId().toString(), c.getBusinessId().toString(), c.getName(), c.getPhone(),
                c.getEmail(), c.getNote(), c.getDistrict(), c.getSince(), c.getUserId() == null ? null : c.getUserId().toString());
    }

    // ── internals ─────────────────────────────────────────────────────────────────────

    private Workspace workspace() {
        Workspace w = access.member();
        WorkspaceAccess.requireType(w, BusinessType.SERVICE);
        return w;
    }

    private Client newClient(UUID businessId, String name, String phone) {
        Client c = new Client();
        c.setBusinessId(businessId);
        c.setName(name);
        c.setPhone(phone);
        c.setSince(clock.instant());
        return c;
    }

    private static String requireName(String raw) {
        String name = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        if (name.length() < 2 || name.length() > 80) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "name", "2–80 characters");
        }
        return name;
    }

    private static String email(String raw) {
        return raw == null || raw.isBlank() ? null : Emails.normalizeOrThrow(raw, "email");
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
