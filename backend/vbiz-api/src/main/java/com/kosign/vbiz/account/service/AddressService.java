package com.kosign.vbiz.account.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.account.domain.Address;
import com.kosign.vbiz.account.mapper.AccountMapper;
import com.kosign.vbiz.account.payload.AddressRequest;
import com.kosign.vbiz.account.payload.AddressResponse;
import com.kosign.vbiz.account.repository.AddressRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.helper.PhoneNumbers;
import com.kosign.vbiz.meta.service.ReferenceDataService;

import lombok.RequiredArgsConstructor;

/**
 * Saved addresses. Rules: the first address is always the default; exactly one default while
 * any exist; deleting the default promotes the oldest remaining one.
 */
@Service
@RequiredArgsConstructor
public class AddressService {

    private final AddressRepository addresses;
    private final ReferenceDataService reference;

    @Transactional(readOnly = true)
    public List<AddressResponse> list(UUID userId) {
        return AccountMapper.toAddresses(addresses.findAllForUser(userId));
    }

    @Transactional
    public AddressResponse create(UUID userId, AddressRequest req) {
        boolean first = addresses.countByUserId(userId) == 0;
        boolean makeDefault = first || Boolean.TRUE.equals(req.isDefault());
        if (makeDefault && !first) {
            addresses.clearDefault(userId);
        }
        Address a = new Address();
        a.setUserId(userId);
        apply(a, req);
        a.setDefault(makeDefault);
        return AccountMapper.toAddress(addresses.saveAndFlush(a));
    }

    @Transactional
    public AddressResponse update(UUID userId, UUID id, AddressRequest req) {
        Address a = require(userId, id);
        apply(a, req);
        // Unsetting the only default is ignored: one address is always the default.
        if (Boolean.TRUE.equals(req.isDefault()) && !a.isDefault()) {
            addresses.saveAndFlush(a);
            addresses.clearDefault(userId);
            a = require(userId, id);
            a.setDefault(true);
        }
        return AccountMapper.toAddress(addresses.saveAndFlush(a));
    }

    @Transactional
    public List<AddressResponse> makeDefault(UUID userId, UUID id) {
        Address a = require(userId, id);
        if (!a.isDefault()) {
            addresses.clearDefault(userId);
            a = require(userId, id);
            a.setDefault(true);
            addresses.saveAndFlush(a);
        }
        return list(userId);
    }

    @Transactional
    public List<AddressResponse> delete(UUID userId, UUID id) {
        Address a = require(userId, id);
        boolean wasDefault = a.isDefault();
        addresses.delete(a);
        addresses.flush();
        if (wasDefault) {
            addresses.findAllForUser(userId).stream().findFirst().ifPresent(next -> {
                next.setDefault(true);
                addresses.saveAndFlush(next);
            });
        }
        return list(userId);
    }

    private Address require(UUID userId, UUID id) {
        return addresses.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new BusinessException(StatusCode.ADDRESS_NOT_FOUND));
    }

    private void apply(Address a, AddressRequest req) {
        if ((req.lat() == null) != (req.lng() == null)) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "lat", "lat and lng go together");
        }
        a.setLabel(req.label());
        a.setName(req.name().trim());
        a.setPhone(PhoneNumbers.normalizeOrThrow(req.phone()));
        a.setLine(req.line().trim());
        a.setDistrict(reference.canonicalDistrict(req.district()));
        a.setNote(req.note() == null || req.note().isBlank() ? null : req.note().trim());
        a.setLat(coord(req.lat()));
        a.setLng(coord(req.lng()));
    }

    private static BigDecimal coord(BigDecimal v) {
        return v == null ? null : v.setScale(6, RoundingMode.HALF_UP);
    }
}
