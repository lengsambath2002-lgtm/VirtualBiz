# API Phase 18: the shop activity log

Owners see who did what in their shop, as platform staff do in the console's audit log.

## Recording

`ShopActivityLog.record(...)` writes a row of `shop_activity` (`V20261022_100000__shop_activity.sql`,
append-only: `business_id`, `actor_id`, `actor_name`, `action`, `target_type`, `target_id`,
`target_label`, `details` JSONB, `at`). It joins the caller's transaction
(`Propagation.MANDATORY`), so an action that fails or is refused leaves no row. Details never hold
null values (`ShopActivityLog.details(...)`).

| Area (`target_type`) | Actions | Recorded by |
|---|---|---|
| MEMBER | `TEAM_INVITED`, `TEAM_INVITE_WITHDRAWN`, `TEAM_ADDED`, `TEAM_ROLE_CHANGED` (from / to), `TEAM_REMOVED`, `TEAM_RESTORED` | `TeamService`, `BusinessService` |
| SHOP | `SETTINGS_CHANGED` (`fields`: the request's fields that were sent) | `BusinessService.update` |
| PRODUCT | `PRODUCT_CREATED`, `PRODUCT_UPDATED`, `PRODUCT_STATUS` (from / to), `PRODUCT_DELETED` | `ProductService` |
| SERVICE | `SERVICE_CREATED`, `SERVICE_UPDATED`, `SERVICE_DELETED`, `SERVICES_ONLINE` | `ServiceItemService` |
| ORDER | `ORDER_REJECTED` (reason, sold out), `ORDER_RETURNED` (reason, restock, total) | `OrderService` |
| SALE | `SALE_REFUNDED` (amount, restock) | `PosService.refund` |
| CUSTOMER | `CUSTOMER_ADDED`, `CUSTOMER_EDITED` (fields) | `ClientService` |
| PROMOTION | `PROMOTION_CREATED`, `PROMOTION_UPDATED`, `PROMOTION_ENDED` | `PromotionService` |
| DATA | `DATA_IMPORTED` (rows, new, updated, skipped), `DATA_EXPORTED` (kind, rows, dates) | imports, `ExportService`, the log's own export |

Routine work (accepting, packing and shipping orders, ringing up sales, stock movements) is not
repeated here: orders keep their own event timeline and stock its movement log.

## Reading

- `GET /api/activity` (owner or manager; staff **FORBIDDEN**): `q` (person or item), `action`,
  `targetType`, `targetId`, `actorId`, `from` / `to`, `page`, `size`; newest first.
- `GET /api/activity/export`: the same filters as CSV (UTF-8 BOM, formula-safe), up to 50,000 rows;
  taking it is logged.
- The log is the shop's own: platform staff don't read it (they have the console's audit log for
  their own actions). The console's shop page shows the owner and the team's size, not its people.

`/seller/activity` and `/provider/activity` (linked from each Team page) show it with the shared list
components: person, area, action and date filters, saved views (`shop.activity`), pages and export.
