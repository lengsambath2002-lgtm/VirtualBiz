package com.kosign.vbiz.delivery.service;

import java.util.List;

import org.springframework.stereotype.Component;

import com.kosign.vbiz.delivery.domain.Rider;

/** Local stand-in for the rider network: the Seller prototype's three riders, picked by order number. */
@Component
public class LocalRiderDispatcher implements RiderDispatcher {

    static final List<Rider> RIDERS = List.of(
            new Rider("Vuthy", "Motorbike", "1A-2345"),
            new Rider("Sophea", "Motorbike", "2B-7781"),
            new Rider("Dara", "Motorbike", "1C-0912"));

    @Override
    public Rider assign(String orderNumber, String pickupDistrict, String dropDistrict) {
        return RIDERS.get(Math.floorMod(orderNumber.hashCode(), RIDERS.size()));
    }
}
