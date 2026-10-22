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

- **Counts** beside a page show work waiting: new orders, low stock, unanswered reviews, booking
  requests, and the console's queues.
- **Bottom:** Settings, View shop / View booking page / View marketplace (opens a new tab) and
  Log out.
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
