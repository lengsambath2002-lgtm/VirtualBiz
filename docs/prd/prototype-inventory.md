# VirtualBiz prototype inventory

The source prototypes are six claude.ai artifacts: single-file HTML pages with mock data. They share a "Liquid Glass" style layer. This page is a factual inventory taken on 2026-10-09. Conflicts between the artifacts are listed in [prototype-open-questions.md](./prototype-open-questions.md).

| Artifact | Link | Platform | Code location |
|---|---|---|---|
| VirtualBiz (landing) | https://claude.ai/artifact/8ZL45gq1LSt5jzQaNRrW4R | Responsive web | `(marketing)`, `features/landing` |
| Sign-in | https://claude.ai/artifact/HmeehTt6K2ZANxorAxqpfz | Responsive web | `(auth)/sign-in`, `features/auth` |
| Customer | https://claude.ai/artifact/TDAtiU6gZqVCKS8cGYN4fT | Web marketplace + phone tab bar | `(shop)`, `features/shop-*` |
| Create Business | https://claude.ai/artifact/TJkgZW7fMrC7CCz4VzRkvF | iPhone-first wizard | `(onboarding)`, `features/business-onboarding` |
| Seller | https://claude.ai/artifact/K7ghVeBWB9oC3Lon6RCsXJ | Desktop admin (Shopify-style) + POS | `(seller)`, `features/seller-*` |
| Service Provider | https://claude.ai/artifact/WAvRjfR5bsN3Rx7yGD1mjD | Desktop workspace (Fresha-style) | `(provider)`, `features/provider-*` |

## Landing

- **Sections:** nav (Shop & book / For business / Pricing / Help, EN·ខ្មែរ), hero search with district picker, payment strip (KHQR, ABA PAY, ACLEDA, Wing, VISA, Mastercard, cash in USD and riel), customer steps, business tabs (sell products / take bookings), pricing calculator, 3-step onboarding, FAQ.
- **Pricing:** 5% of online orders and bookings. POS sales are free.
- **Rules:**
  - Individual sellers can sell up to $1,000 a month online without registering.
  - Payouts go to the Bakong ID the next business day.
  - Riders return COD cash within 24 h.
  - Delivery is by VirtualBiz rider, the shop's own delivery, or customer pickup.
  - Staff are invited by phone as Manager or Staff.

## Sign-in

- **Steps:** `start` (Google / phone / email lookup) → `password` | `signup` | `phone` → `code` (6-digit OTP, used to verify signup, log in, reset a password or confirm a phone) → `newpass` / `phonename` → `onboard` (what brings you here) → `home`.
- **Rules:**
  - OTP lasts 10 minutes. Resend after 30 s. Maximum 5 attempts.
  - 5 wrong passwords lock sign-in for 30 s.
  - A password needs 8+ characters with upper and lowercase, a number and a symbol, and must not contain the email name.
  - Sessions last 30 days. "Log out of all devices" is available.

## Customer

- **Routes:** home, search (filters, sort, Products/Services/Shops tabs), product (`p-{id}`), service booking (`s-{id}`: staff → day → 30-min slot), confirm booking, shop page, deals, cart, checkout, order tracking, booking detail, account (orders, bookings, saved, addresses, profile).
- **Cart:** grouped by shop. Checkout creates **one order per shop**.
- **Checkout:** Delivery or Pickup. ASAP or a scheduled time window. Pay by KHQR, saved card, or cash (COD or at pickup).
- **Order tracking:** placed → confirmed → preparing → on the way → delivered, live. Cancel within 5 minutes.
- **Bookings:** reschedule or cancel up to 2 h before. Paid at the shop.
- **Login:** browsing and the cart work without login. Saving, following, booking, checkout and reviews need it.

## Create Business

1. Type (product or service), shop name and category.
2. District, street, customer phone, opening hours.
3. Bakong ID (`name@bank`) and an ID photo.
4. Done: shop link `virtualbiz.com.kh/{slug}` and a "Get ready" checklist.

The draft survives reloads. The shop opens right away; payouts start once the ID is verified.

## Seller

- **Pages:** home (to-dos, KPIs, 30-day chart), POS register, orders, products and editor, inventory, promotions, customers, reviews, settings.
- **Order flow:**
  1. New: Accept or Reject (with a reason). Orders not accepted within 1 h are auto-cancelled.
  2. To pack: scan-verified pack list.
  3. Ready: hand to a VirtualBiz rider, use own delivery, or customer pickup.
  4. Out for delivery: Delivered, or Delivery failed (goes back to Ready).
  5. Delivered: invoice, return or refund within 7 days.
- **Products:** up to 3 options generate a variant matrix. Each variant has price, compare-at, cost, SKU (unique), barcode (unique, auto-generated if empty) and stock.
- **Inventory:** a stock-movement log with reasons. **Online orders and the POS share one stock count.**
- **POS:**
  - Shifts with a counted float in USD and riel.
  - Scan, search or tap a tile.
  - Discount, customer, hold or resume a sale.
  - Pay by cash (USD + KHR, change shown), KHQR, card terminal, or split.
  - Receipt by SMS or Telegram. Refund per line. Close shift with a count (within $0.25 counts as balanced).
  - Sales queue while offline and sync later.
- **Settings:** shop online toggle, auto-accept, prep time, default low-stock level, pickup, delivery zone fees, free-over amount, KHQR merchant ID, COD toggle.

## Service Provider

- **Pages:** home, calendar (default page: staff columns × 15-min grid, drag to reschedule, blocks), sales, clients (segments, notes), services, team (shifts, colours), marketing (deals, reviews), settings (hours, closures, booking rules).
- **Appointment statuses:** requested, booked, confirmed, arrived, started, completed, no-show, cancelled, declined. Sources: online, phone, walk-in.
- **Checkout:** services plus retail products, discount, tip for the staff member, pay by cash, KHQR or card. Receipt by SMS. "Book next visit".
- **Booking rules:** online booking, auto-confirm, SMS reminder (24 h, $0.02 per SMS), minimum notice, free-cancellation window, gap between bookings.

## Design tokens (shared glass layer)

- **Colours:** ink `#141A2B`, primary `#1C2438`, accent `#F5B800`, ok `#1C8556`, info `#2F5BD3`, danger `#D93B3B`, bg `#F2F2F7`.
- **Radius:** 12 / 20 / 28. Buttons and chips are capsules.
- **Font:** `-apple-system, "SF Pro Text", "Inter"`.
- **Themes:** light and dark, plus reduced-transparency and reduced-motion fallbacks.
- **Logo:** yellow rounded "B" with the wordmark Virtual**Biz**.
