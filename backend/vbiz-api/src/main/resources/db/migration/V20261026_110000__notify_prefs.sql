-- Notification choices per topic and channel (docs/ops/email.md § Choices), replacing the single
-- "emails" switch. Stored as the topics turned OFF per channel, so a new topic starts on:
-- {"email": ["STOCK"], "push": []}. The in-app inbox always gets everything.
ALTER TABLE users ADD COLUMN notify_off JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE users SET notify_off =
    '{"email": ["ORDERS", "BOOKINGS", "SHOP_ACTIVITY", "STOCK", "REVIEWS", "ACCOUNT"]}'::jsonb
    WHERE pref_emails = FALSE;

ALTER TABLE users DROP COLUMN pref_emails;
