package com.kosign.vbiz.customer.service;

import java.time.Clock;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.business.service.WorkspaceAccess;
import com.kosign.vbiz.business.service.WorkspaceAccess.Workspace;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.helper.Emails;
import com.kosign.vbiz.common.helper.PhoneNumbers;
import com.kosign.vbiz.common.imports.ImportReport;
import com.kosign.vbiz.common.imports.RowCheck;
import com.kosign.vbiz.customer.domain.Client;
import com.kosign.vbiz.customer.repository.ClientRepository;
import com.kosign.vbiz.meta.service.ReferenceDataService;

import lombok.RequiredArgsConstructor;

/**
 * Customer CSV import (docs/api/phase16-shop-lists.md), product shops and service providers. The
 * columns are the customer export's. The phone matches an existing customer, whose name, email,
 * district and note the row updates (blank cells leave a field as it is); a new phone adds one.
 */
@Service
@RequiredArgsConstructor
public class ClientImportService {

    private final WorkspaceAccess access;
    private final ClientRepository clients;
    private final ReferenceDataService reference;
    private final Clock clock;

    private record Plan(Client existing, String name, String phone, String email, String district, String note) {
    }

    @Transactional
    public ImportReport run(List<Map<String, String>> rows, boolean dryRun, boolean skipInvalid) {
        Workspace w = access.manager();
        Map<String, Client> byPhone = new HashMap<>();
        for (Client c : clients.findByBusinessIdOrderByNameAscIdAsc(w.businessId())) {
            byPhone.put(c.getPhone(), c);
        }
        List<ImportReport.RowError> errors = new ArrayList<>();
        List<Plan> plans = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        int created = 0;
        int updated = 0;
        int same = 0;
        for (int i = 0; i < rows.size(); i++) {
            RowCheck c = new RowCheck(rows.get(i), i);
            String name = c.required("Name", 80);
            if (name != null && name.length() < 2) {
                c.error("Name", "At least 2 characters");
            }
            String phone = null;
            String raw = c.required("Phone", 20);
            if (raw != null) {
                phone = PhoneNumbers.normalize(raw);
                if (!PhoneNumbers.isValid(phone)) {
                    c.error("Phone", "Not a Cambodian phone number");
                } else if (!seen.add(phone)) {
                    c.error("Phone", "This phone is on an earlier row too");
                }
            }
            String email = c.optional("Email", 254);
            if (email != null) {
                try {
                    email = Emails.normalizeOrThrow(email, "Email");
                } catch (BusinessException e) {
                    c.error("Email", "Not a valid email address");
                }
            }
            String district = c.optional("District", 40);
            if (district != null) {
                try {
                    district = reference.canonicalDistrict(district);
                } catch (BusinessException e) {
                    c.error("District", "Not a Phnom Penh district");
                }
            }
            String note = c.optional("Note", 500);
            if (!c.ok()) {
                errors.addAll(c.errors());
                plans.add(null);
                continue;
            }
            Client existing = byPhone.get(phone);
            Plan p = new Plan(existing, name, phone, email, district, note);
            if (existing == null) {
                created++;
            } else if (changes(existing, p)) {
                updated++;
            } else {
                same++;
                p = null;
            }
            plans.add(p);
        }
        int bad = errors.isEmpty() ? 0 : (int) errors.stream().map(ImportReport.RowError::line).distinct().count();
        boolean apply = !dryRun && (errors.isEmpty() || skipInvalid);
        if (apply) {
            List<Client> save = new ArrayList<>();
            for (Plan p : plans.stream().filter(Objects::nonNull).toList()) {
                Client c = p.existing();
                if (c == null) {
                    c = new Client();
                    c.setBusinessId(w.businessId());
                    c.setPhone(p.phone());
                    c.setSince(clock.instant());
                }
                c.setName(p.name());
                if (p.email() != null) {
                    c.setEmail(p.email());
                }
                if (p.district() != null) {
                    c.setDistrict(p.district());
                }
                if (p.note() != null) {
                    c.setNote(p.note());
                }
                save.add(c);
            }
            clients.saveAllAndFlush(save);
        }
        return new ImportReport(rows.size(), created, updated, same + bad, errors, apply);
    }

    private static boolean changes(Client c, Plan p) {
        return !p.name().equals(c.getName()) || (p.email() != null && !p.email().equals(c.getEmail()))
                || (p.district() != null && !p.district().equals(c.getDistrict()))
                || (p.note() != null && !p.note().equals(c.getNote()));
    }
}
