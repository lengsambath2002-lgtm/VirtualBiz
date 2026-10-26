package com.kosign.vbiz.meta.payload;

/** A text in English and Khmer. An empty Khmer text shows the English one. */
public record Localized(String en, String kh) {

    public static final Localized EMPTY = new Localized("", "");

    public Localized trimmed() {
        return new Localized(en == null ? "" : en.strip(), kh == null ? "" : kh.strip());
    }
}
