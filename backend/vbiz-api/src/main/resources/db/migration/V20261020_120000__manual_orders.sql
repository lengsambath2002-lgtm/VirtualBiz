-- Manual orders (docs/api/phase8-manual-orders.md): orders a shop takes by phone, Facebook,
-- Telegram or at the counter for delivery / pickup, entered by its staff.

-- A manual order may have no VirtualBiz account behind it: the contact is kept on the order.
ALTER TABLE orders ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE orders ADD COLUMN source VARCHAR(10) NOT NULL DEFAULT 'ONLINE'
    CHECK (source IN ('ONLINE', 'PHONE', 'FACEBOOK', 'TELEGRAM', 'WALK_IN', 'OTHER'));
ALTER TABLE orders ADD COLUMN contact_name  VARCHAR(80);
ALTER TABLE orders ADD COLUMN contact_phone VARCHAR(10);
ALTER TABLE orders ADD CONSTRAINT ck_orders_customer
    CHECK (customer_id IS NOT NULL OR contact_name IS NOT NULL);
CREATE INDEX ix_orders_source ON orders (business_id, source) WHERE source <> 'ONLINE';

-- DIRECT: the customer paid the shop itself (cash in hand, KHQR or a bank transfer to the shop's
-- own account). No VirtualBiz commission, never part of a payout.
ALTER TABLE payment DROP CONSTRAINT payment_channel_check;
ALTER TABLE payment ADD CONSTRAINT payment_channel_check
    CHECK (channel IN ('ONLINE', 'COD', 'POS', 'DIRECT'));
