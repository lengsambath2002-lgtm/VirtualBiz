package com.kosign.vbiz.notification.service;

import java.util.Map;

import com.kosign.vbiz.notification.domain.NotificationKind;

/**
 * The words of each notification email (docs/ops/email.md), in English and Khmer, from the same
 * kind and params the inbox shows. {@code forShop}: the notification went to a shop's inbox (its
 * owner and managers read the email), not to a customer.
 */
public final class NotificationEmailContent {

    /** One email: the subject, a heading and a line in each language, and the button's label. */
    public record Words(String subject, String heading, String line, String headingKh, String lineKh,
            String button, String buttonKh) {
    }

    private NotificationEmailContent() {
    }

    /** The email for a notification, or null for a kind that isn't emailed. */
    public static Words of(String kind, Map<String, String> p, boolean forShop) {
        String no = p.getOrDefault("number", "");
        String shop = p.getOrDefault("shop", "");
        String when = p.containsKey("date") ? p.get("date") + " " + p.getOrDefault("time", "") : "";
        String reason = reason(p.get("reason"), false);
        String reasonKh = reason(p.get("reason"), true);
        String why = reason.isEmpty() ? "" : " Reason: " + reason + ".";
        String whyKh = reasonKh.isEmpty() ? "" : " មូលហេតុ៖ " + reasonKh + "។";
        return switch (kind) {
            // ── customers ────────────────────────────────────────────────────────────
            case NotificationKind.ORDER_PLACED -> new Words("Order " + no + " placed with " + shop,
                    "Thanks for your order", "We sent order " + no + " ($" + p.getOrDefault("amount", "") + ") to " + shop
                            + ". You'll hear from us when they accept it.",
                    "អរគុណសម្រាប់ការបញ្ជាទិញ", "យើងបានផ្ញើការបញ្ជាទិញ " + no + " ($" + p.getOrDefault("amount", "") + ") ទៅ " + shop
                            + "។ យើងនឹងប្រាប់អ្នកពេលហាងទទួល។",
                    "Track your order", "តាមដានការបញ្ជាទិញ");
            case NotificationKind.ORDER_ACCEPTED -> new Words("Order " + no + " accepted by " + shop,
                    "Your order is being prepared", shop + " accepted order " + no + " and is preparing it.",
                    "ការបញ្ជាទិញរបស់អ្នកកំពុងរៀបចំ", shop + " បានទទួលការបញ្ជាទិញ " + no + " ហើយកំពុងរៀបចំ។",
                    "Track your order", "តាមដានការបញ្ជាទិញ");
            case NotificationKind.ORDER_READY_PICKUP -> new Words("Order " + no + " is ready to pick up",
                    "Ready to pick up", "Your order " + no + " from " + shop + " is ready. Show the order number at the counter.",
                    "រួចរាល់សម្រាប់មកយក", "ការបញ្ជាទិញ " + no + " ពី " + shop + " រួចរាល់។ សូមបង្ហាញលេខការបញ្ជាទិញនៅតុគិតលុយ។",
                    "View the order", "មើលការបញ្ជាទិញ");
            case NotificationKind.ORDER_ON_THE_WAY -> new Words("Order " + no + " is on the way",
                    "Your order is on the way", shop + " sent order " + no
                            + (p.containsKey("rider") ? " with " + p.get("rider") : "") + ". It's coming to you now.",
                    "ការបញ្ជាទិញកំពុងដឹកមក", shop + " បានផ្ញើការបញ្ជាទិញ " + no + " ហើយ។",
                    "Track your order", "តាមដានការបញ្ជាទិញ");
            case NotificationKind.ORDER_DELIVERED, NotificationKind.ORDER_PICKED_UP -> new Words(
                    "Order " + no + (kind.equals(NotificationKind.ORDER_DELIVERED) ? " was delivered" : " was picked up"),
                    "Enjoy your order", "Order " + no + " from " + shop + " is complete. You can rate the shop from your orders.",
                    "ការបញ្ជាទិញបានបញ្ចប់", "ការបញ្ជាទិញ " + no + " ពី " + shop + " បានបញ្ចប់។ អ្នកអាចវាយតម្លៃហាងបាន។",
                    "Rate your order", "វាយតម្លៃ");
            case NotificationKind.ORDER_RETURNED -> new Words("Order " + no + " was returned",
                    "Return recorded", shop + " recorded the return of order " + no + " ($" + p.getOrDefault("amount", "") + ").",
                    "បានកត់ត្រាការប្រគល់វិញ", shop + " បានកត់ត្រាការប្រគល់ការបញ្ជាទិញ " + no + " វិញ។",
                    "View the order", "មើលការបញ្ជាទិញ");
            case NotificationKind.ORDER_CANCELLED -> forShop
                    ? new Words("Order " + no + " was cancelled", "An order was cancelled",
                            "Order " + no + " was cancelled." + why, "ការបញ្ជាទិញត្រូវបានបោះបង់",
                            "ការបញ្ជាទិញ " + no + " ត្រូវបានបោះបង់។" + whyKh, "Open the order", "បើកការបញ្ជាទិញ")
                    : new Words("Order " + no + " was cancelled", "Your order was cancelled",
                            shop + " order " + no + " was cancelled." + why
                                    + " If you paid online, the money goes back the way you paid.",
                            "ការបញ្ជាទិញរបស់អ្នកត្រូវបានបោះបង់", "ការបញ្ជាទិញ " + no + " ពី " + shop + " ត្រូវបានបោះបង់។" + whyKh,
                            "View the order", "មើលការបញ្ជាទិញ");
            case NotificationKind.BOOKING_REQUESTED -> forShop
                    ? new Words("Booking request from " + p.getOrDefault("name", ""), "New booking request",
                            p.getOrDefault("name", "") + " asked for " + p.getOrDefault("service", "") + " on " + when
                                    + ". Accept or decline it in your calendar.",
                            "សំណើកក់ថ្មី", p.getOrDefault("name", "") + " បានស្នើ " + p.getOrDefault("service", "") + " នៅ " + when + "។",
                            "Answer the request", "ឆ្លើយតបសំណើ")
                    : new Words("Booking request sent to " + shop, "Request sent",
                            p.getOrDefault("service", "") + " on " + when + ". " + shop + " will confirm it soon.",
                            "បានផ្ញើសំណើ", p.getOrDefault("service", "") + " នៅ " + when + "។ " + shop + " នឹងបញ្ជាក់ឆាប់ៗ។",
                            "View the booking", "មើលការកក់");
            case NotificationKind.BOOKING_CONFIRMED -> new Words(
                    "Booking confirmed: " + p.getOrDefault("service", "") + ", " + when, "You're booked",
                    p.getOrDefault("service", "") + " at " + shop + " on " + when + " is confirmed. See you then.",
                    "ការកក់បានបញ្ជាក់", p.getOrDefault("service", "") + " នៅ " + shop + " ថ្ងៃ " + when + " បានបញ្ជាក់។",
                    "View the booking", "មើលការកក់");
            case NotificationKind.BOOKING_DECLINED -> new Words(shop + " couldn't take your booking",
                    "Booking not available", shop + " couldn't take " + p.getOrDefault("service", "") + " on " + when + "." + why
                            + (p.containsKey("message") ? " Their message: “" + p.get("message") + "”" : "")
                            + " Try another time.",
                    "មិនអាចកក់បាន", shop + " មិនអាចទទួល " + p.getOrDefault("service", "") + " ថ្ងៃ " + when + " បានទេ។" + whyKh,
                    "Book another time", "កក់ពេលផ្សេង");
            case NotificationKind.BOOKING_CHANGED -> new Words("Your booking moved to " + when, "New time for your booking",
                    shop + " moved " + p.getOrDefault("service", "") + " to " + when + ".",
                    "ការកក់ប្ដូរពេល", shop + " បានប្ដូរ " + p.getOrDefault("service", "") + " ទៅ " + when + "។",
                    "View the booking", "មើលការកក់");
            case NotificationKind.BOOKING_REMINDER -> new Words(
                    "Reminder: " + p.getOrDefault("service", "") + " at " + shop + ", " + when, "See you soon",
                    p.getOrDefault("service", "") + " at " + shop + " on " + when + ".",
                    "កុំភ្លេច", p.getOrDefault("service", "") + " នៅ " + shop + " ថ្ងៃ " + when + "។",
                    "View the booking", "មើលការកក់");
            case NotificationKind.BOOKING_CANCELLED -> forShop
                    ? new Words(p.getOrDefault("name", "") + " cancelled their booking", "A booking was cancelled",
                            p.getOrDefault("name", "") + " cancelled their visit on " + when + "." + why,
                            "ការកក់ត្រូវបានបោះបង់", p.getOrDefault("name", "") + " បានបោះបង់ការកក់ថ្ងៃ " + when + "។" + whyKh,
                            "Open the calendar", "បើកប្រតិទិន")
                    : new Words(shop + " cancelled your booking", "Booking cancelled",
                            shop + " cancelled " + p.getOrDefault("service", "") + " on " + when + "." + why,
                            "ការកក់ត្រូវបានបោះបង់", shop + " បានបោះបង់ " + p.getOrDefault("service", "") + " ថ្ងៃ " + when + "។" + whyKh,
                            "Book again", "កក់ម្តងទៀត");
            // ── shops ────────────────────────────────────────────────────────────────
            case NotificationKind.NEW_ORDER -> new Words("New order " + no + ": $" + p.getOrDefault("amount", ""),
                    "New order", p.getOrDefault("name", "") + " placed order " + no + " for $" + p.getOrDefault("amount", "")
                            + ". Accept it within an hour, or it cancels itself.",
                    "ការបញ្ជាទិញថ្មី", p.getOrDefault("name", "") + " បានបញ្ជាទិញ " + no + " ($" + p.getOrDefault("amount", "")
                            + ")។ សូមទទួលក្នុងរយៈពេលមួយម៉ោង។",
                    "Open the order", "បើកការបញ្ជាទិញ");
            case NotificationKind.NEW_REVIEW -> new Words("New " + p.getOrDefault("stars", "") + "★ review from "
                    + p.getOrDefault("name", ""), "A customer left a review",
                    p.getOrDefault("name", "") + " rated you " + p.getOrDefault("stars", "") + " out of 5. A reply shows them you care.",
                    "ការវាយតម្លៃថ្មី", p.getOrDefault("name", "") + " បានវាយតម្លៃ " + p.getOrDefault("stars", "") + "/5។",
                    "Reply", "ឆ្លើយតប");
            case NotificationKind.BUSINESS_VERIFIED -> new Words(p.getOrDefault("name", "") + " is verified",
                    "Your shop is verified", "VirtualBiz checked " + p.getOrDefault("name", "")
                            + ". Shoppers now see it as verified.",
                    "ហាងរបស់អ្នកបានផ្ទៀងផ្ទាត់", "VirtualBiz បានផ្ទៀងផ្ទាត់ " + p.getOrDefault("name", "") + " ហើយ។",
                    "Open your shop", "បើកហាង");
            case NotificationKind.BUSINESS_REJECTED -> new Words("We couldn't verify " + p.getOrDefault("name", ""),
                    "Verification not passed", "VirtualBiz couldn't verify " + p.getOrDefault("name", "") + "." + why
                            + " Update your details and try again.",
                    "មិនអាចផ្ទៀងផ្ទាត់បាន", "VirtualBiz មិនអាចផ្ទៀងផ្ទាត់ " + p.getOrDefault("name", "") + " បានទេ។" + whyKh,
                    "Open settings", "បើកការកំណត់");
            case NotificationKind.BUSINESS_SUSPENDED -> new Words(p.getOrDefault("name", "") + " is paused on VirtualBiz",
                    "Your shop is paused", "VirtualBiz paused " + p.getOrDefault("name", "") + "." + why
                            + " Shoppers can't see it until it's reinstated. Contact support if you have questions.",
                    "ហាងរបស់អ្នកត្រូវបានផ្អាក", "VirtualBiz បានផ្អាក " + p.getOrDefault("name", "") + "។" + whyKh,
                    "Open your shop", "បើកហាង");
            case NotificationKind.BUSINESS_REINSTATED -> new Words(p.getOrDefault("name", "") + " is back on VirtualBiz",
                    "Your shop is back", p.getOrDefault("name", "") + " is visible to shoppers again.",
                    "ហាងរបស់អ្នកបានត្រឡប់មកវិញ", p.getOrDefault("name", "") + " អាចមើលឃើញម្តងទៀត។",
                    "Open your shop", "បើកហាង");
            case NotificationKind.PAYOUT_SENT -> new Words("Payout sent: $" + p.getOrDefault("amount", ""),
                    "We paid you", "VirtualBiz sent $" + p.getOrDefault("amount", "") + " to " + p.getOrDefault("bakongId", "")
                            + " (reference " + p.getOrDefault("reference", "") + ").",
                    "យើងបានទូទាត់ជូនអ្នក", "VirtualBiz បានផ្ញើ $" + p.getOrDefault("amount", "") + " ទៅ " + p.getOrDefault("bakongId", "") + "។",
                    "View payouts", "មើលការទូទាត់");
            case NotificationKind.CATEGORY_APPROVED -> new Words("Category approved: " + p.getOrDefault("category", ""),
                    "Your category suggestion was approved", "“" + p.getOrDefault("asked", "") + "” is now "
                            + p.getOrDefault("category", "") + ("true".equals(p.get("moved")) ? ", and your shop is listed there." : "."),
                    "ប្រភេទត្រូវបានអនុម័ត", "“" + p.getOrDefault("asked", "") + "” ឥឡូវជា " + p.getOrDefault("category", "") + "។",
                    "Open settings", "បើកការកំណត់");
            case NotificationKind.CATEGORY_REJECTED -> new Words("Category suggestion declined",
                    "Your category suggestion was declined", "“" + p.getOrDefault("asked", "") + "” wasn't added." + why,
                    "សំណើប្រភេទត្រូវបានបដិសេធ", "“" + p.getOrDefault("asked", "") + "” មិនត្រូវបានបន្ថែមទេ។" + whyKh,
                    "Open settings", "បើកការកំណត់");
            default -> null;
        };
    }

    /** A cancel / decline reason code in words, as the app shows it; free text as it is. */
    static String reason(String code, boolean kh) {
        if (code == null || code.isBlank()) {
            return "";
        }
        String[] k = code.split("\\.", 2);
        String key = k.length > 1 ? k[1] : k[0];
        String en = switch (k[0]) {
            case "rejected" -> "rejected: " + switch (key) {
                case "outOfStock" -> "item out of stock";
                case "cantDeliver" -> "can't deliver to this area today";
                case "listingError" -> "price or listing error";
                case "closingEarly" -> "shop closing early";
                default -> key;
            };
            case "returned" -> switch (key) {
                case "damaged" -> "damaged on arrival";
                case "wrongItem" -> "wrong item sent";
                case "changedMind" -> "changed mind (within 7 days)";
                default -> key;
            };
            case "failed" -> switch (key) {
                case "noAnswer" -> "customer not answering the phone";
                case "wrongAddress" -> "wrong address";
                case "refused" -> "customer refused the parcel";
                default -> key;
            };
            case "auto" -> "not accepted within 1 hour";
            case "customer", "client", "clientAsked" -> "the customer cancelled";
            case "admin" -> "cancel".equals(key) ? "cancelled by VirtualBiz support" : "refunded by VirtualBiz support";
            case "fullyBooked" -> "fully booked";
            case "stylistNA", "stylistUnavailable" -> "the stylist isn't available";
            case "notOffered" -> "this service isn't offered then";
            case "shopClosed" -> "the shop is closed";
            case "rescheduled" -> "moved to another time";
            default -> code;
        };
        if (!kh) {
            return en;
        }
        return switch (k[0]) {
            case "rejected" -> "បានបដិសេធ";
            case "auto" -> "មិនបានទទួលក្នុងរយៈពេល ១ ម៉ោង";
            case "customer", "client", "clientAsked" -> "អតិថិជនបានបោះបង់";
            case "admin" -> "ដោយក្រុមជំនួយ VirtualBiz";
            case "fullyBooked" -> "ពេញ";
            case "shopClosed" -> "ហាងបិទ";
            default -> en;
        };
    }
}
