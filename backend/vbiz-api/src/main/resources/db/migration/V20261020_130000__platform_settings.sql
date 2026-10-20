-- Platform settings the super-admin changes from the console (docs/api/phase7-admin.md § Settings),
-- replacing vbiz.payment.commission-pct, vbiz.payouts.release-after and the frontend's fixed
-- exchange rate. One row; every change is in admin_audit.
CREATE TABLE platform_settings (
    id                 SMALLINT      PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    -- VirtualBiz's share of each paid online payment, taken when the payment is created.
    commission_pct     NUMERIC(4, 2) NOT NULL CHECK (commission_pct >= 0 AND commission_pct <= 30),
    -- Days after delivery / pickup before a paid online payment can be paid out to the shop.
    payout_delay_days  SMALLINT      NOT NULL CHECK (payout_delay_days BETWEEN 0 AND 30),
    -- Riel per US dollar for the KHR shown next to USD prices (rounded to 100 riel).
    khr_per_usd        INTEGER       NOT NULL CHECK (khr_per_usd BETWEEN 1000 AND 10000),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_by         VARCHAR(80)
);

INSERT INTO platform_settings (id, commission_pct, payout_delay_days, khr_per_usd) VALUES (1, 5, 1, 4100);

-- Categories get a Khmer name so ones added from the console show in both languages.
ALTER TABLE category ADD COLUMN name_kh VARCHAR(80);

UPDATE category SET name_kh = CASE id
    WHEN 'cafe' THEN 'កាហ្វេ'
    WHEN 'electronics' THEN 'គ្រឿងអេឡិចត្រូនិក'
    WHEN 'fashion' THEN 'សម្លៀកបំពាក់'
    WHEN 'grocery' THEN 'គ្រឿងទេស'
    WHEN 'spa' THEN 'ស្ប៉ា'
    WHEN 'beauty' THEN 'សម្រស់'
    WHEN 'salon' THEN 'ហាងសក់'
    WHEN 'repair' THEN 'ជួសជុល'
    WHEN 'beauty-products' THEN 'ផលិតផលសម្រស់'
    WHEN 'fitness' THEN 'ហាត់ប្រាណ'
    WHEN 'other-product' THEN 'ផ្សេងៗ'
    WHEN 'other-service' THEN 'ផ្សេងៗ'
    ELSE name END;

ALTER TABLE category ALTER COLUMN name_kh SET NOT NULL;

-- Icons the marketplace can draw (it has no "dumbbell" or "grid").
UPDATE category SET icon = 'heart' WHERE icon = 'dumbbell';
UPDATE category SET icon = 'tag' WHERE icon = 'grid';

ALTER TABLE admin_audit DROP CONSTRAINT admin_audit_target_type_check;
ALTER TABLE admin_audit ADD CONSTRAINT admin_audit_target_type_check CHECK (target_type IN ('USER', 'BUSINESS',
    'ORDER', 'REVIEW', 'PROMOTION', 'PAYOUT', 'SETTINGS', 'CATEGORY'));
