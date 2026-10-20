-- Shop policy (docs/api/phase11-shop-settings.md): receipt text, VAT, counter payment methods
-- and social links, the same for product shops and service providers. Null = defaults.
ALTER TABLE business ADD COLUMN policy JSONB;
