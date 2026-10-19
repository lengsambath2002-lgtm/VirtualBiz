package com.kosign.vbiz.common.helper;

/** Per-request header values, set by {@link com.kosign.vbiz.common.filter.RequestIdFilter}. */
public final class HeaderContext {

    public static final String REQUEST_ID = "X-Request-Id";

    private static final ThreadLocal<String> requestId = new ThreadLocal<>();

    private HeaderContext() {
    }

    public static String getRequestId() {
        return requestId.get();
    }

    public static void setRequestId(String value) {
        requestId.set(value);
    }

    public static void clear() {
        requestId.remove();
    }
}
