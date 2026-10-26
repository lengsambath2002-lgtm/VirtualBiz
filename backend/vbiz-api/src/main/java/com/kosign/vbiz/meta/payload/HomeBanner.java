package com.kosign.vbiz.meta.payload;

/**
 * One banner on the marketplace homepage. {@code body} may mark a promo code with
 * {@code **CODE**} (shown highlighted); {@code cta} is the button (the main banner only);
 * {@code href} is a page of the site ({@code /deals}) or an https address.
 */
public record HomeBanner(boolean visible, Localized eyebrow, Localized title, Localized body, Localized cta,
        String href) {
}
