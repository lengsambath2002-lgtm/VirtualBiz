package com.kosign.vbiz.account.mapper;

import java.math.BigDecimal;
import java.util.List;

import com.kosign.vbiz.account.domain.Address;
import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.payload.AddressResponse;
import com.kosign.vbiz.account.payload.MeResponse;
import com.kosign.vbiz.account.payload.PrefsDto;
import com.kosign.vbiz.account.payload.UserResponse;
import com.kosign.vbiz.auth.domain.SignInMethod;

/** Entity → payload for the account domain. */
public final class AccountMapper {

    private AccountMapper() {
    }

    public static UserResponse toUser(User u) {
        return new UserResponse(u.getId().toString(), u.getName(), u.getEmail(), u.getPhone(), u.getAvatarUrl(), u.getCoverUrl(),
                methods(u), u.getCreatedAt(), u.getPlatformRole());
    }

    public static MeResponse toMe(User u) {
        return new MeResponse(u.getId().toString(), u.getName(), u.getEmail(), u.getPhone(), u.getAvatarUrl(), u.getCoverUrl(),
                methods(u), u.getCreatedAt(), toPrefs(u), u.getPlatformRole());
    }

    public static PrefsDto toPrefs(User u) {
        return new PrefsDto(u.isPrefDeals(), u.isPrefPromos(), u.isPrefEmails());
    }

    public static AddressResponse toAddress(Address a) {
        return new AddressResponse(a.getId().toString(), a.getUserId().toString(), a.getLabel(), a.getName(),
                a.getPhone(), a.getLine(), a.getDistrict(), a.getNote(), toDouble(a.getLat()), toDouble(a.getLng()),
                a.isDefault());
    }

    public static List<AddressResponse> toAddresses(List<Address> list) {
        return list.stream().map(AccountMapper::toAddress).toList();
    }

    /** In enum order, so the client sees a stable list. */
    private static List<SignInMethod> methods(User u) {
        return u.getSignInMethods().stream().sorted().toList();
    }

    private static Double toDouble(BigDecimal v) {
        return v == null ? null : v.doubleValue();
    }
}
