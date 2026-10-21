package com.kosign.vbiz.pos.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.domain.ShopPolicy;
import com.kosign.vbiz.business.repository.BusinessRepository;
import com.kosign.vbiz.business.service.WorkspaceAccess;
import com.kosign.vbiz.business.service.WorkspaceAccess.Workspace;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.helper.Money;
import com.kosign.vbiz.common.security.SecureTokens;
import com.kosign.vbiz.pos.domain.Sale;
import com.kosign.vbiz.pos.payload.ReceiptView;
import com.kosign.vbiz.pos.repository.SaleLineRepository;
import com.kosign.vbiz.pos.repository.SalePaymentRepository;
import com.kosign.vbiz.pos.repository.SaleRefundRepository;
import com.kosign.vbiz.pos.repository.SaleRepository;

import lombok.RequiredArgsConstructor;

/**
 * Shareable receipts (docs/api/phase13-messages.md): a shop member gets a sale's public link
 * (an unguessable token, made once), and anyone with the link sees the receipt. The shop sends
 * it with Telegram, SMS or email from its own phone; nothing is sent by VirtualBiz.
 */
@Service
@RequiredArgsConstructor
public class ReceiptService {

    public static final String PATH = "/r/";

    private final WorkspaceAccess access;
    private final SaleRepository sales;
    private final SaleLineRepository lines;
    private final SalePaymentRepository payments;
    private final SaleRefundRepository refunds;
    private final BusinessRepository businesses;

    /** The sale's receipt link (made on first share). {@code ref}: its number (R- / S-). */
    @Transactional
    public Map<String, String> share(String ref) {
        Workspace w = access.member();
        Sale s = sales.findByNumber(ref == null ? "" : ref.trim().toUpperCase(Locale.ROOT))
                .filter(x -> x.getBusinessId().equals(w.businessId()))
                .orElseThrow(() -> new BusinessException(StatusCode.SALE_NOT_FOUND));
        if (s.getShareToken() == null) {
            s.setShareToken(SecureTokens.randomToken());
            sales.saveAndFlush(s);
        }
        return Map.of("token", s.getShareToken(), "path", PATH + s.getShareToken());
    }

    @Transactional(readOnly = true)
    public ReceiptView view(String token) {
        Sale s = sales.findByShareToken(token == null ? "" : token)
                .orElseThrow(() -> new BusinessException(StatusCode.SALE_NOT_FOUND));
        Business b = businesses.findById(s.getBusinessId())
                .orElseThrow(() -> new BusinessException(StatusCode.SALE_NOT_FOUND));
        ShopPolicy p = ShopPolicy.of(b.getPolicy());
        List<ReceiptView.Line> ls = lines.findBySaleIdInOrderByPositionAsc(List.of(s.getId())).stream()
                .map(l -> new ReceiptView.Line(l.getTitle(), l.getVariantName(), l.getQty(), l.getUnitPrice()))
                .toList();
        List<ReceiptView.Payment> ps = payments.findBySaleIdInOrderByPositionAsc(List.of(s.getId())).stream()
                .map(x -> new ReceiptView.Payment(x.getMethod(), x.getAmount())).toList();
        BigDecimal refunded = Money.usd(refunds.findBySaleIdInOrderByAtAsc(List.of(s.getId())).stream()
                .map(r -> r.getAmount()).reduce(BigDecimal.ZERO, BigDecimal::add));
        String address = b.getStreet() + ", " + b.getDistrict();
        return new ReceiptView(s.getNumber(), s.getAt(),
                new ReceiptView.Shop(b.getName(), b.getLogoUrl(), b.getPhone(), address, p.receiptHeader(),
                        p.receiptFooter(), p.taxPct(), p.taxId()),
                ls, s.getSubtotal(), s.getDiscount(), s.getTip(), s.getTotal(), ps, refunded, s.getCustomerName(),
                s.getByName());
    }
}
