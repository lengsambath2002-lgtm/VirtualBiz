# Workspace and console navigation

The seller workspace, the provider workspace and the super-admin console share one navigation
component, `src/components/layout/SideNav.tsx`. Each surface lists its own destinations
(`SellerRail`, `ProviderShell`'s `Rail`, `AdminRail`); the layout, behaviour and wording are
shared.

## Sidebar (wider than 1180px)

- **Top:** the shop's logo, name and whether it is open on VirtualBiz (the console shows
  "VirtualBiz Admin" and the staff role).
- **Pages in groups:** the main pages first, without a heading, then named groups.

  | Surface  | Main                                            | Groups                                                                  |
  | -------- | ----------------------------------------------- | ----------------------------------------------------------------------- |
  | Seller   | Home, POS, Orders, Products, Inventory          | Customers (Customers, Promotions, Reviews) · Manage (Team, Activity log) |
  | Provider | Home, Calendar, Sales, Clients, Services        | Grow (Marketing) · Manage (Team, Activity log)                          |
  | Console  | Overview                                        | Marketplace (Shops, Users, Orders, Reviews) · Money (Payouts, Promo codes) · Platform (Audit log) |

- **Counts** beside a page show work waiting. Hovering says what a count is; clicking it opens
  the list filtered to exactly those rows (the page link itself opens the whole list):

  | Surface  | Page      | Count                                                         | Opens                                |
  | -------- | --------- | ------------------------------------------------------------- | ------------------------------------ |
  | Console  | Shops     | shops waiting for an ID check                                 | `/admin/shops?verification=PENDING`  |
  | Console  | Orders    | stuck: new for 30 min, or accepted / packed for over a day    | `/admin/orders?status=stuck`         |
  | Console  | Reviews   | visible 1–2 star reviews from the last 7 days                 | `/admin/reviews?status=low&from…to`  |
  | Console  | Payouts   | shops owed a payout now                                       | `/admin/payouts?due=payable`         |
  | Seller   | Orders    | new orders waiting to be accepted                             | `/seller/orders?tab=new`             |
  | Seller   | Inventory | products low or out of stock                                  | `/seller/inventory?f=low`            |
  | Seller   | Reviews   | reviews without a reply                                       | `/seller/reviews?replied=no`         |
  | Provider | Calendar  | booking requests to answer                                    | `/provider/calendar?requests=1`      |
  | Provider | Marketing | reviews without a reply                                       | `/provider/marketing?tab=reviews`    |
- **Bottom, the same for every role and surface:** Settings, Explore (the marketplace's Explore
  page, in a new tab) and Log out.
- **Collapse handle:** a round ‹ / › button on the sidebar's right edge, half-way down.
- The current page has `aria-current="page"`, a filled background and an accent bar.

## Icons only

The collapse handle leaves the icons (names on hover; counts become a dot). This device
remembers the choice (`localStorage` `vb-sidenav-collapsed`). Between 861px and 1180px the sidebar
is always icons only.

## Phones (860px and narrower)

A bottom bar holds four main pages and **More**. More opens the whole sidebar as a drawer from
the left, which closes on a choice, on Escape or on a tap outside. The shop name moves into the
header (`phoneOnly`), because there's no sidebar to show it.

## Header

Search (Ctrl K) on the left; on the right the surface's actions (Scan, + New), language,
notifications and the account / workspace switcher.
