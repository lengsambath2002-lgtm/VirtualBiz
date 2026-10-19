package com.kosign.vbiz.catalog.service;

import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.catalog.domain.BarcodeSequence;
import com.kosign.vbiz.catalog.repository.BarcodeSequenceRepository;
import com.kosign.vbiz.catalog.repository.ProductVariantRepository;

import lombok.RequiredArgsConstructor;

/** Auto-generated barcodes: the shop's next free 885000000xxx number (prototype {@code barcodeSeq}). */
@Service
@RequiredArgsConstructor
public class BarcodeService {

    private final BarcodeSequenceRepository sequences;
    private final ProductVariantRepository variants;

    /** Next barcode not used by a live variant of the shop nor in {@code reserved}. */
    @Transactional(propagation = Propagation.MANDATORY)
    public String next(UUID businessId, Set<String> reserved) {
        BarcodeSequence seq = sequences.lock(businessId).orElseGet(() -> {
            BarcodeSequence s = new BarcodeSequence();
            s.setBusinessId(businessId);
            s.setLastValue(BarcodeSequence.START);
            return sequences.saveAndFlush(s);
        });
        long n = seq.getLastValue();
        String code;
        do {
            code = String.valueOf(++n);
        } while (reserved.contains(code) || variants.barcodeUsed(businessId, code));
        seq.setLastValue(n);
        sequences.save(seq);
        return code;
    }
}
