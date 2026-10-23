-- docs/ops/email.md: emails about a person's orders, bookings and shops (every inbox
-- notification), on unless they turn them off in My settings.
ALTER TABLE users ADD COLUMN pref_emails BOOLEAN NOT NULL DEFAULT TRUE;
