package com.kosign.vbiz.delivery.service;

import com.kosign.vbiz.delivery.domain.Rider;

/**
 * Finds a VirtualBiz rider for a packed delivery order. The rider network (app, live position)
 * does not exist yet; {@link LocalRiderDispatcher} hands out the prototype's riders.
 */
public interface RiderDispatcher {

    Rider assign(String orderNumber, String pickupDistrict, String dropDistrict);
}
