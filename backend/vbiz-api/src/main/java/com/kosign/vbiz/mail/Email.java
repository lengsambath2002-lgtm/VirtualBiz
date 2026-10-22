package com.kosign.vbiz.mail;

import java.util.ArrayList;
import java.util.List;

import org.springframework.web.util.HtmlUtils;

/**
 * One email in the VirtualBiz look, as HTML (inline styles, table layout, so mail apps show it as
 * meant) and the same words as plain text. Build it top to bottom: a heading, lines, buttons, small
 * print. Everything given is escaped.
 */
public final class Email {

    private static final String INK = "#141a2b";
    private static final String MUTED = "#5f6677";
    private static final String LINE = "#e6e8ee";

    private final List<String> html = new ArrayList<>();
    private final List<String> text = new ArrayList<>();
    private String preheader = "";

    /** The grey line mail apps show after the subject. */
    public Email preheader(String s) {
        this.preheader = s;
        return this;
    }

    /** The shop's (or VirtualBiz's) mark and name above the heading. */
    public Email badge(String name, String logoUrl) {
        String mark = logoUrl != null && !logoUrl.isBlank()
                ? "<img src=\"" + esc(logoUrl) + "\" width=\"48\" height=\"48\" alt=\"\" style=\"border-radius:12px;display:block\">"
                : "<div style=\"width:48px;height:48px;border-radius:12px;background:#ffd23f;color:" + INK
                        + ";font:700 22px/48px Arial,sans-serif;text-align:center\">" + esc(initial(name)) + "</div>";
        html.add("<tr><td style=\"padding:0 0 16px\"><table role=\"presentation\"><tr><td>" + mark
                + "</td><td style=\"padding-left:12px;font:600 15px Arial,sans-serif;color:" + INK + "\">" + esc(name)
                + "</td></tr></table></td></tr>");
        return this;
    }

    public Email heading(String s) {
        html.add("<tr><td style=\"padding:0 0 12px;font:700 22px/1.3 Arial,sans-serif;color:" + INK + "\">" + esc(s)
                + "</td></tr>");
        text.add(s);
        text.add("");
        return this;
    }

    public Email line(String s) {
        html.add("<tr><td style=\"padding:0 0 12px;font:15px/1.55 Arial,sans-serif;color:" + INK + "\">" + esc(s)
                + "</td></tr>");
        text.add(s);
        return this;
    }

    /** A boxed fact ("Role: Staff — orders, the register …"). */
    public Email fact(String label, String value) {
        html.add("<tr><td style=\"padding:4px 0 16px\"><table role=\"presentation\" width=\"100%\" style=\"border:1px solid "
                + LINE + ";border-radius:12px\"><tr><td style=\"padding:12px 14px;font:13px/1.5 Arial,sans-serif;color:"
                + MUTED + "\"><strong style=\"color:" + INK + ";font-size:14px\">" + esc(label) + "</strong><br>"
                + esc(value) + "</td></tr></table></td></tr>");
        text.add(label + ": " + value);
        return this;
    }

    /** A large code (sign-in codes). */
    public Email code(String code) {
        html.add("<tr><td style=\"padding:4px 0 16px;font:700 32px/1 'Courier New',monospace;letter-spacing:8px;color:"
                + INK + "\">" + esc(code) + "</td></tr>");
        text.add("");
        text.add(code);
        text.add("");
        return this;
    }

    /** A primary button and, optionally, a quieter second one beside it. */
    public Email buttons(String primary, String primaryUrl, String secondary, String secondaryUrl) {
        StringBuilder b = new StringBuilder("<tr><td style=\"padding:8px 0 20px\"><table role=\"presentation\"><tr>");
        b.append(button(primary, primaryUrl, INK, "#ffffff", INK));
        if (secondary != null) {
            b.append("<td style=\"width:10px\"></td>").append(button(secondary, secondaryUrl, "#ffffff", INK, "#cfd3dc"));
        }
        html.add(b.append("</tr></table></td></tr>").toString());
        text.add("");
        text.add(primary + ": " + primaryUrl);
        if (secondary != null) {
            text.add(secondary + ": " + secondaryUrl);
        }
        text.add("");
        return this;
    }

    public Email small(String s) {
        html.add("<tr><td style=\"padding:0 0 8px;font:12.5px/1.5 Arial,sans-serif;color:" + MUTED + "\">" + esc(s)
                + "</td></tr>");
        text.add(s);
        return this;
    }

    /** A thin rule (between the English and Khmer versions). */
    public Email divider() {
        html.add("<tr><td style=\"padding:12px 0 20px\"><div style=\"border-top:1px solid " + LINE + "\"></div></td></tr>");
        text.add("");
        text.add("———");
        text.add("");
        return this;
    }

    public String text() {
        return String.join("\n", text) + "\n\n— VirtualBiz, Phnom Penh\n";
    }

    public String html() {
        return "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\">"
                + "</head><body style=\"margin:0;background:#f3f4f7\">"
                + "<div style=\"display:none;max-height:0;overflow:hidden;color:transparent\">" + esc(preheader) + "</div>"
                + "<table role=\"presentation\" width=\"100%\" style=\"background:#f3f4f7\"><tr><td align=\"center\" style=\"padding:28px 12px\">"
                + "<table role=\"presentation\" width=\"100%\" style=\"max-width:520px;background:#ffffff;border-radius:18px;"
                + "border:1px solid " + LINE + "\"><tr><td style=\"padding:28px 28px 16px\"><table role=\"presentation\" width=\"100%\">"
                + String.join("", html)
                + "</table></td></tr></table>"
                + "<p style=\"font:12px Arial,sans-serif;color:" + MUTED + ";margin:16px 0 0\">VirtualBiz · Phnom Penh, Cambodia</p>"
                + "</td></tr></table></body></html>";
    }

    private static String button(String label, String url, String bg, String fg, String border) {
        return "<td style=\"border-radius:999px;background:" + bg + ";border:1px solid " + border + "\">"
                + "<a href=\"" + esc(url) + "\" style=\"display:inline-block;padding:12px 26px;font:600 15px Arial,sans-serif;color:"
                + fg + ";text-decoration:none;border-radius:999px\">" + esc(label) + "</a></td>";
    }

    private static String initial(String name) {
        return name == null || name.isBlank() ? "V" : name.trim().substring(0, 1).toUpperCase();
    }

    private static String esc(String s) {
        return s == null ? "" : HtmlUtils.htmlEscape(s, "UTF-8");
    }
}
