# API Phase 8: manual orders

Product shops also sell outside the marketplace: a customer calls, writes on Facebook or
Telegram, or walks in and asks for delivery. Staff enter those orders in the Seller workspace
(**New → Manual order**, or **Manual order** on the Orders page) so they share the order flow,
the stock and the customer list with marketplace orders. Same base path, envelope and
`X-Business-Id` tenancy as Phases 1–7.

## Endpoint

`POST /api/orders/manual` (any member of a `PRODUCT` business; `WRONG_BUSINESS_TYPE` otherwise)
→ **201** `Order` (the shop view).

| Field | Required | Notes |
|---|---|---|
| `source` | yes | `PHONE`, `FACEBOOK`, `TELEGRAM`, `WALK_IN` or `OTHER` (`ONLINE` is refused) |
| `name` | yes | the customer's name, 2–80 characters |
| `phone` | for delivery | Cambodian number (`INVALID_PHONE`); optional for pickup |
| `method` | yes | `DELIVERY` or `PICKUP` |
| `line`, `district`, `addressNote` | for delivery | the address the rider goes to |
| `lines` | yes | `[{variantId, qty}]`, the shop's own live products only (`VARIANT_NOT_FOUND`) |
| `deliveryFee` | no | USD; defaults to the shop's zone fee for the district (free over its threshold) |
| `discount` | no | USD off the items, at most their price |
| `payment` | yes | `COD` (cash on delivery / at pickup), `PAID_CASH` or `PAID_KHQR` (paid to the shop up front) |
| `note` | no | up to 120 characters |

## What happens

- Prices are the variants' current prices.
- Stock is taken through the stock writer as `ORDER_SALE` movements by the staff member who
  entered the order (`INSUFFICIENT_STOCK` when there isn't enough).
- The order is `ACCEPTED` right away: it is the shop's own decision. The timeline shows NEW and
  ACCEPTED by that staff member. From there it follows the normal flow: pack, ship or pickup,
  deliver, return.
- `orders.customer_id` is null (no VirtualBiz account). The contact is kept on the order
  (`contact_name`, `contact_phone`), and the response's `customer` is
  `{name, phone}` without an `id`. `Order.source` says where it came from (`ONLINE` for marketplace
  orders).
- The customer is added to the shop's clients by phone, like marketplace buyers.
- Payment: `COD` is a `COD`-channel payment, `PENDING` until delivered with the cash collected.
  `PAID_*` is a `DIRECT`-channel payment (the money went to the shop itself), `PAID` at once.
  Neither carries VirtualBiz commission, and neither is ever part of a payout. Cancelling or
  returning a paid manual order marks the payment `REFUNDED` without any gateway call; the shop
  refunds the customer itself.
- No customer notifications (there is no account to notify). The shop's other devices get the
  live `order` event.

The admin console lists manual orders with the contact's name ("no account (entered by the
shop)").

## Database

Flyway `V20261020_120000__manual_orders.sql`: `orders.customer_id` nullable, `orders.source`,
`contact_name`, `contact_phone` (with a check that one of account or contact is set), and the
`DIRECT` payment channel.
