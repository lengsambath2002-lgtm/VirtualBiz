# Prototype open questions

The six prototype artifacts disagree on the points below. Each needs a decision, recorded as an FRD or ADR, before the related domain is built. Each item lists **Proposed**: the default we'll build if nobody objects.

| # | Topic | Conflict | Proposed |
|---|---|---|---|
| 1 | Onboarding roles | Sign-in offers `shop / service / seller`. Create Business and Landing offer product vs service. | Everyone is a customer. A business is `PRODUCT` or `SERVICE`. |
| 2 | Booking status | Customer: Confirmed / Cancelled / Rescheduled (confirmed instantly). Provider: 9 statuses, `autoConfirm=false`. | Use Provider's enum as the source. Customer sees "Requested" until the provider confirms, unless auto-confirm is on. |
| 3 | Reminder timing | Customer: 2 h before. Provider setting: 24 h before. | Provider setting decides. Default 24 h. |
| 4 | Booking deposits / fee | Landing promises deposits and 5% "per booking", but bookings are pay-at-shop. | No deposits in v1. Decide how the commission on bookings is collected. |
| 5 | Order status | Customer steps 1–5 vs Seller `new…returned`. Customer has no "returned" or "delivery failed". | Use Seller's enum. Map it to customer-facing labels. |
| 6 | Cancellation | Customer can cancel within 5 min. Seller auto-cancels orders not accepted within 1 h. | Keep both: customer cancel while `new` and ≤5 min; auto-cancel at 1 h. |
| 7 | Delivery fee | Customer: distance ($0.75 + $0.30/km after 2 km). Seller: 3 fixed zones. | Seller zones (per shop). Free-over threshold is per shop. |
| 8 | Payment methods | `KHQR/Card/Cash` vs `KHQR/COD/Card` vs POS `Split`. | One enum: `KHQR, CARD, CASH`, with `channel` = online / COD / POS. Split = several payment rows. |
| 9 | IDs | `VB-24038` / `O1041`, `BK-2201` / `A4101`. | Order `VB-xxxxx` everywhere, booking `BK-xxxxx`. |
| 10 | Districts | 5 / 8 / 10 options. | One `meta.district` table (Create Business's 10 as the seed). |
| 11 | Categories | Four different sets. | Two levels: platform categories (marketplace) and shop-defined collections. |
| 12 | Staff roles | FAQ says Manager / Staff. Seller has no team page. Provider role is free text. | `business_member.role` = OWNER / MANAGER / STAFF, plus a free-text title for the calendar. Add a team page to Seller. |
| 13 | Languages | Only Landing and Sign-in have Khmer. | All surfaces ship en + kh. |
| 14 | Phone validation | `^0[1-9]\d{7,8}$` vs `^0\d{8,9}$`. | Use `^0[1-9]\d{7,8}$` and normalize `+855`. |
| 15 | Platform admin | No prototype for ID verification, payouts or disputes. | ~~Decided 2026-10-09: out of scope.~~ **Reopened 2026-10-16:** the owner asked for a super-admin console (`/admin`): verification, payouts, disputes and moderation. See `docs/api/phase7-admin.md`. |
