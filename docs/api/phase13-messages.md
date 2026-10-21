# API Phase 13: messages that really go out

No button pretends to send something. Receipts become a link anyone can open, a decline carries
the shop's own words, and booked clients get a reminder before the visit.

## Receipt links

| Method & path | Who | Returns |
|---|---|---|
| POST `/api/sales/{number}/share` | a member of the sale's shop (`X-Business-Id`) | `{token, path}` with `path` = `/r/{token}`; the same token every time for that sale; **404** for a number the shop doesn't have |
| GET `/api/receipts/{token}` | anyone (no sign-in) | the receipt: number, time, shop (name, logo, phone, address, receipt header and footer, VAT rate and number), lines, subtotal, discount, tip, total, payments, refunded, customer name (as entered at the sale), cashier; **404** for an unknown token |

- The token is 32 random bytes (base64url) in `sale.share_token` (unique). It is only made when
  someone shares the receipt, and it is the only way to reach it: sale numbers are guessable, tokens
  are not. The page sends `noindex` and `no-referrer`.
- The register's and the service checkout's receipt offer **Telegram** (t.me share), **SMS** (an
  `sms:` link with the customer's phone when known), **Copy link** and **Print**. The page at
  `/{locale}/r/{token}` prints itself with `?print=1`.
- The product shop's invoice **Email invoice** opens the customer's mail app with the lines, total
  and payment filled in (`mailto:`).

## Decline message

`POST /api/appointments/{ref}/status` takes `message` (up to 300 characters) beside `reason`. With
`DECLINED` it is kept in `appointment.decline_message`, sent with the customer's
`BOOKING_DECLINED` notification (`params.message`), and returned as `declineMessage` by
`GET /api/me/bookings`. The customer's booking page shows it as "{shop} said".

## Booking reminders

`BookingReminders` runs every `vbiz.bookings.reminders.interval` (default 5 minutes;
`vbiz.bookings.reminders.enabled` turns it off). A `BOOKED` or `CONFIRMED` appointment gets one
reminder when its start is within the shop's `bookingSettings.reminderHours` (0 = none, up to
168):

- a `BOOKING_REMINDER` notification to the customer's account (online bookings), linking to the
  booking;
- an SMS to the client's phone through `ReminderSms`. Until an SMS provider is contracted, the
  bean is `LoggingReminderSms`, which writes the message to the log.

`appointment.reminded_at` records the send, so a reminder never goes twice, also after a restart.
A failure for one appointment is logged and the rest still go.

Migration: `V20261021_120000__receipts_reminders.sql`.
