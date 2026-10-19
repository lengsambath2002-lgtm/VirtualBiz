package com.kosign.vbiz.common.api;

import java.text.MessageFormat;

import org.springframework.http.HttpStatus;

/**
 * Status codes use the enum name as the wire code (e.g. {@code "INVALID_CREDENTIALS"}), not
 * numbers. {@code message} is for developers and logs only; clients translate from the code.
 * Domains add their own codes here as they are built, grouped by section.
 */
public enum StatusCode {

    // ── General ────────────────────────────────────────────────────────────────────────
    SUCCESS(HttpStatus.OK, ErrorType.NONE, "Success"),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, ErrorType.SYSTEM, "Internal server error"),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, ErrorType.BUSINESS, "HTTP method not allowed for this path"),
    CONFLICT(HttpStatus.CONFLICT, ErrorType.BUSINESS, "Resource already exists or conflicts with current state"),
    INVALID_STATUS_TRANSITION(HttpStatus.CONFLICT, ErrorType.BUSINESS, "Status cannot change from {0} to {1}"),
    NOT_CONFIGURED(HttpStatus.SERVICE_UNAVAILABLE, ErrorType.SYSTEM, "This feature is not configured on the server"),

    // ── Validation ─────────────────────────────────────────────────────────────────────
    INVALID_REQUEST(HttpStatus.BAD_REQUEST, ErrorType.VALIDATION, "Invalid request"),
    VALIDATION_FAILED(HttpStatus.UNPROCESSABLE_ENTITY, ErrorType.VALIDATION, "Validation failed"),
    INVALID_PHONE(HttpStatus.BAD_REQUEST, ErrorType.VALIDATION, "Phone number is not a valid Cambodian number"),
    INVALID_AMOUNT(HttpStatus.BAD_REQUEST, ErrorType.VALIDATION, "Amount is not a valid USD amount"),

    // ── Auth ───────────────────────────────────────────────────────────────────────────
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, ErrorType.AUTH, "Authentication required"),
    INVALID_TOKEN(HttpStatus.UNAUTHORIZED, ErrorType.AUTH, "Invalid or expired token"),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, ErrorType.AUTH, "Invalid email or password"),
    ACCOUNT_SUSPENDED(HttpStatus.FORBIDDEN, ErrorType.AUTH, "This account is suspended"),
    ACCOUNT_LOCKED(HttpStatus.UNAUTHORIZED, ErrorType.AUTH, "Sign-in is temporarily locked after repeated failed attempts"),
    REFRESH_TOKEN_INVALID(HttpStatus.UNAUTHORIZED, ErrorType.AUTH, "Refresh token invalid or expired"),
    OTP_INVALID(HttpStatus.UNAUTHORIZED, ErrorType.AUTH, "Verification code is incorrect"),
    OTP_EXPIRED(HttpStatus.UNAUTHORIZED, ErrorType.AUTH, "Verification code has expired"),
    OTP_ATTEMPTS_EXCEEDED(HttpStatus.TOO_MANY_REQUESTS, ErrorType.AUTH, "Too many verification attempts"),
    OTP_RESEND_TOO_SOON(HttpStatus.TOO_MANY_REQUESTS, ErrorType.AUTH, "Wait before requesting another code"),
    FORBIDDEN(HttpStatus.FORBIDDEN, ErrorType.AUTH, "Access denied"),
    ADMIN_ONLY(HttpStatus.FORBIDDEN, ErrorType.AUTH, "Only VirtualBiz staff can do this"),
    SUPER_ADMIN_ONLY(HttpStatus.FORBIDDEN, ErrorType.AUTH, "Only a super-admin can do this"),
    FORBIDDEN_TENANT(HttpStatus.FORBIDDEN, ErrorType.AUTH, "Not a member of this business"),
    BUSINESS_CONTEXT_REQUIRED(HttpStatus.BAD_REQUEST, ErrorType.AUTH, "This request must be made on behalf of a business"),

    // ── Not found ──────────────────────────────────────────────────────────────────────
    NOT_FOUND(HttpStatus.NOT_FOUND, ErrorType.BUSINESS, "Resource not found"),
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, ErrorType.BUSINESS, "User not found"),
    ADDRESS_NOT_FOUND(HttpStatus.NOT_FOUND, ErrorType.BUSINESS, "Address not found"),
    DISTRICT_NOT_FOUND(HttpStatus.NOT_FOUND, ErrorType.BUSINESS, "District not found"),
    CATEGORY_NOT_FOUND(HttpStatus.NOT_FOUND, ErrorType.BUSINESS, "Category not found"),
    BUSINESS_NOT_FOUND(HttpStatus.NOT_FOUND, ErrorType.BUSINESS, "Business not found"),
    MEMBER_NOT_FOUND(HttpStatus.NOT_FOUND, ErrorType.BUSINESS, "Business member not found"),
    PRODUCT_NOT_FOUND(HttpStatus.NOT_FOUND, ErrorType.BUSINESS, "Product not found"),
    VARIANT_NOT_FOUND(HttpStatus.NOT_FOUND, ErrorType.BUSINESS, "Variant not found"),
    SERVICE_NOT_FOUND(HttpStatus.NOT_FOUND, ErrorType.BUSINESS, "Service not found"),
    ORDER_NOT_FOUND(HttpStatus.NOT_FOUND, ErrorType.BUSINESS, "Order not found"),
    APPOINTMENT_NOT_FOUND(HttpStatus.NOT_FOUND, ErrorType.BUSINESS, "Appointment not found"),
    CLIENT_NOT_FOUND(HttpStatus.NOT_FOUND, ErrorType.BUSINESS, "Client not found"),
    SALE_NOT_FOUND(HttpStatus.NOT_FOUND, ErrorType.BUSINESS, "Sale not found"),
    SHIFT_NOT_FOUND(HttpStatus.NOT_FOUND, ErrorType.BUSINESS, "Shift not found"),
    PROMOTION_NOT_FOUND(HttpStatus.NOT_FOUND, ErrorType.BUSINESS, "Promotion not found"),
    REVIEW_NOT_FOUND(HttpStatus.NOT_FOUND, ErrorType.BUSINESS, "Review not found"),
    NOTIFICATION_NOT_FOUND(HttpStatus.NOT_FOUND, ErrorType.BUSINESS, "Notification not found"),
    LISTING_NOT_FOUND(HttpStatus.NOT_FOUND, ErrorType.BUSINESS, "No product or service is listed under that slug or id"),
    MOVEMENT_NOT_FOUND(HttpStatus.NOT_FOUND, ErrorType.BUSINESS, "Stock movement not found"),
    COLLECTION_NOT_FOUND(HttpStatus.NOT_FOUND, ErrorType.BUSINESS, "Collection not found"),

    // ── Catalog / inventory ────────────────────────────────────────────────────────────
    INSUFFICIENT_STOCK(HttpStatus.CONFLICT, ErrorType.BUSINESS, "Stock cannot go below zero"),
    DUPLICATE_SKU(HttpStatus.CONFLICT, ErrorType.BUSINESS, "SKU is already used in this shop"),
    DUPLICATE_BARCODE(HttpStatus.CONFLICT, ErrorType.BUSINESS, "Barcode is already used in this shop"),
    WRONG_BUSINESS_TYPE(HttpStatus.CONFLICT, ErrorType.BUSINESS, "Not available for this type of business"),

    // ── Checkout / orders / payments ───────────────────────────────────────────────────
    PROMO_INVALID(HttpStatus.UNPROCESSABLE_ENTITY, ErrorType.BUSINESS, "The promo code does not apply"),
    SHOP_UNAVAILABLE(HttpStatus.CONFLICT, ErrorType.BUSINESS, "The shop is not taking orders"),
    FULFILMENT_UNAVAILABLE(HttpStatus.CONFLICT, ErrorType.BUSINESS, "The shop does not offer this fulfilment method"),
    PAYMENT_METHOD_UNAVAILABLE(HttpStatus.CONFLICT, ErrorType.BUSINESS, "The shop does not accept this payment method"),
    IDEMPOTENCY_CONFLICT(HttpStatus.CONFLICT, ErrorType.BUSINESS, "The idempotency key was used for a different request"),
    CANCEL_WINDOW_PASSED(HttpStatus.CONFLICT, ErrorType.BUSINESS, "It can no longer be cancelled or changed"),
    RETURN_WINDOW_PASSED(HttpStatus.CONFLICT, ErrorType.BUSINESS, "The return window has passed"),
    UNDO_WINDOW_PASSED(HttpStatus.CONFLICT, ErrorType.BUSINESS, "Too late to undo"),
    PAYMENT_NOT_FOUND(HttpStatus.NOT_FOUND, ErrorType.BUSINESS, "Payment not found"),
    PAYMENT_EXPIRED(HttpStatus.CONFLICT, ErrorType.BUSINESS, "The payment expired"),
    PAYMENT_FAILED(HttpStatus.PAYMENT_REQUIRED, ErrorType.BUSINESS, "The payment was declined"),
    SLOT_UNAVAILABLE(HttpStatus.CONFLICT, ErrorType.BUSINESS, "That time is no longer available"),
    BOOKING_UNAVAILABLE(HttpStatus.CONFLICT, ErrorType.BUSINESS, "The shop is not taking online bookings for this service"),
    FILE_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE, ErrorType.BUSINESS, "The file is too large"),
    UNSUPPORTED_FILE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ErrorType.BUSINESS, "Use a JPEG, PNG or WebP image"),
    SHIFT_ALREADY_OPEN(HttpStatus.CONFLICT, ErrorType.BUSINESS, "A shift is already open"),
    DUPLICATE_CLIENT(HttpStatus.CONFLICT, ErrorType.BUSINESS, "Another client already has this phone number"),
    SHOP_SUSPENDED(HttpStatus.CONFLICT, ErrorType.BUSINESS, "The shop is suspended"),
    VERIFICATION_REQUIRED(HttpStatus.CONFLICT, ErrorType.BUSINESS, "The shop's ID must be verified first"),
    PAYOUT_ACCOUNT_MISSING(HttpStatus.CONFLICT, ErrorType.BUSINESS, "The shop has no Bakong ID for payouts"),
    NOTHING_TO_PAY(HttpStatus.CONFLICT, ErrorType.BUSINESS, "No released payments to pay out"),
    STREAM_TICKET_INVALID(HttpStatus.UNAUTHORIZED, ErrorType.AUTH, "Invalid or expired stream ticket");

    private final HttpStatus httpStatus;
    private final ErrorType errorType;
    private final String message;

    StatusCode(HttpStatus httpStatus, ErrorType errorType, String message) {
        this.httpStatus = httpStatus;
        this.errorType = errorType;
        this.message = message;
    }

    public String getCode() {
        return name();
    }

    public HttpStatus getHttpStatus() {
        return httpStatus;
    }

    public ErrorType getErrorType() {
        return errorType;
    }

    public String getMessage() {
        return message;
    }

    public String formatMessage(Object... args) {
        return args == null || args.length == 0 ? message : MessageFormat.format(message, args);
    }
}
