package com.kosign.vbiz.payment.service;

import java.util.List;
import java.util.UUID;

/** The order numbers a payment session covers (implemented by the order domain). */
public interface PaymentOrderRefs {

    List<String> numbersOfIntent(UUID intentId);
}
