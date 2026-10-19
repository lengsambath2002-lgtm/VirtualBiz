-- Local-only Seller data (local + test profiles via classpath:db/seed-local), from the Seller mock
-- before it was removed (frontend/src/lib/mock/seller.ts SELLER_PROMOTIONS, seller-history.ts
-- SELLER_POS_SALES / SELLER_OPEN_SHIFT) with their formulas. Times are relative to the migration
-- run (Phnom Penh days). Each counter sale has its POS_SALE movement; one RECEIVED "Stock before
-- counter history" movement per variant keeps every variant at its seeded stock (stock = Σ movements).

-- ── Nita Gadget Store's promotions (the shop code is NITAWATER: WATERFEST is the platform's) ──
INSERT INTO promotion (id, business_id, name, type, value, code, scope, target_ids, min_spend, max_discount, starts_at, ends_at, uses, usage_limit) VALUES
    ('88888888-0000-4000-8000-000000000101', '22222222-2222-4222-8222-000000000001', 'Water Festival 10%', 'PERCENT', 10, 'NITAWATER', 'ALL', '[]'::jsonb, NULL, NULL,
     ((now() AT TIME ZONE 'Asia/Phnom_Penh')::date - 3)::timestamp AT TIME ZONE 'Asia/Phnom_Penh',
     ((now() AT TIME ZONE 'Asia/Phnom_Penh')::date + 13)::timestamp AT TIME ZONE 'Asia/Phnom_Penh' - interval '1 millisecond', 38, 200),
    ('88888888-0000-4000-8000-000000000102', '22222222-2222-4222-8222-000000000001', 'Accessories: buy any case, $3 off', 'FIXED', 3, NULL, 'CATEGORY',
     '["dddddddd-0000-4000-8000-000000000005"]'::jsonb, 12, NULL,
     ((now() AT TIME ZONE 'Asia/Phnom_Penh')::date - 10)::timestamp AT TIME ZONE 'Asia/Phnom_Penh',
     ((now() AT TIME ZONE 'Asia/Phnom_Penh')::date + 21)::timestamp AT TIME ZONE 'Asia/Phnom_Penh' - interval '1 millisecond', 61, NULL),
    ('88888888-0000-4000-8000-000000000103', '22222222-2222-4222-8222-000000000001', 'Free delivery over $15', 'FREE_SHIPPING', 0, NULL, 'ALL', '[]'::jsonb, 15, NULL,
     ((now() AT TIME ZONE 'Asia/Phnom_Penh')::date + 5)::timestamp AT TIME ZONE 'Asia/Phnom_Penh',
     ((now() AT TIME ZONE 'Asia/Phnom_Penh')::date + 10)::timestamp AT TIME ZONE 'Asia/Phnom_Penh' - interval '1 millisecond', 0, NULL),
    ('88888888-0000-4000-8000-000000000104', '22222222-2222-4222-8222-000000000001', 'Back to school', 'PERCENT', 15, 'SCHOOL15', 'PRODUCTS',
     '["aaaaaaaa-0000-4000-8000-000000000016"]'::jsonb, NULL, NULL,
     ((now() AT TIME ZONE 'Asia/Phnom_Penh')::date - 50)::timestamp AT TIME ZONE 'Asia/Phnom_Penh',
     ((now() AT TIME ZONE 'Asia/Phnom_Penh')::date - 19)::timestamp AT TIME ZONE 'Asia/Phnom_Penh' - interval '1 millisecond', 12, 50);

-- ── A month of counter sales (receipts R-05201…), one shift per day ──
CREATE TEMP TABLE counter_sold (variant_id uuid, qty int) ON COMMIT DROP;

DO $$
DECLARE
    biz      CONSTANT uuid := '22222222-2222-4222-8222-000000000001';
    owner    CONSTANT uuid := '11111111-1111-4111-8111-000000000001';
    today    CONSTANT date := (now() AT TIME ZONE 'Asia/Phnom_Penh')::date;
    picks    text[] := ARRAY['cable', 'case15', 'anker', 'airpods', 'case15', 'cable', 'watch9', 'glass'];
    pick_vi  int[]  := ARRAY[0, 0, 0, 0, 1, 0, 1, 0];
    methods  text[] := ARRAY['CASH', 'KHQR', 'CASH', 'CARD'];
    n int := 5200;
    d int; i int; k int; slot int; qty int; at_ts timestamptz; day_start timestamptz;
    v_id uuid; p_id uuid; p_title text; v_name text; price numeric; total numeric;
    shift uuid; sale uuid; method text; cash_in numeric;
BEGIN
    FOR d IN REVERSE 30..0 LOOP
        day_start := (today - d)::timestamp AT TIME ZONE 'Asia/Phnom_Penh';
        shift := md5('nita-shift-' || d)::uuid;
        INSERT INTO pos_shift (id, business_id, opened_by, opened_by_name, opened_at, float_usd, float_khr)
        VALUES (shift, biz, owner, 'Kry Sonita', day_start + interval '8 hours', 50, 0);
        cash_in := 0;
        k := CASE WHEN d = 0 THEN 4 ELSE 2 + (d % 4) END;
        FOR i IN 0..k - 1 LOOP
            at_ts := day_start + make_interval(secs => ((8.5 + i * 1.7) * 3600)::int);
            CONTINUE WHEN at_ts > now();
            slot := ((d * 3 + i) % 8) + 1;
            SELECT v.id, p.id, p.title, v.price,
                   coalesce((SELECT string_agg(x, ' / ') FROM jsonb_array_elements_text(v.option_values) x), '')
              INTO v_id, p_id, p_title, price, v_name
              FROM product p JOIN product_variant v ON v.product_id = p.id
             WHERE p.slug = 'nita-' || picks[slot] AND v.position = pick_vi[slot];
            qty := CASE WHEN picks[slot] = 'cable' THEN 2 ELSE 1 END;
            total := price * qty;
            method := methods[((d + i) % 4) + 1];
            n := n + 1;
            sale := md5('nita-r' || n)::uuid;
            INSERT INTO sale (id, number, business_id, shift_id, subtotal, discount, tip, total, by_user_id, by_name, at)
            VALUES (sale, 'R-' || lpad(n::text, 5, '0'), biz, shift, total, 0, 0, total, owner, 'Kry Sonita', at_ts);
            INSERT INTO sale_line (id, sale_id, position, product_id, variant_id, title, variant_name, qty, unit_price)
            VALUES (gen_random_uuid(), sale, 0, p_id, v_id, p_title, v_name, qty, price);
            INSERT INTO sale_payment (id, sale_id, position, method, amount)
            VALUES (gen_random_uuid(), sale, 0, method, total);
            INSERT INTO stock_movement (id, business_id, variant_id, delta, reason, by_user_id, by_name, note, at)
            VALUES (gen_random_uuid(), biz, v_id, -qty, 'POS_SALE', owner, 'Kry Sonita', 'R-' || lpad(n::text, 5, '0'), at_ts);
            INSERT INTO counter_sold VALUES (v_id, qty);
            IF method = 'CASH' THEN
                cash_in := cash_in + total;
            END IF;
        END LOOP;
        -- Earlier days closed at 20:00 with the drawer counting what it should; today stays open.
        IF d > 0 THEN
            UPDATE pos_shift SET closed_at = day_start + interval '20 hours', closed_by_name = 'Kry Sonita',
                   expected_usd = 50 + cash_in, counted_usd = 50 + cash_in, difference = 0
             WHERE id = shift;
        END IF;
    END LOOP;
    PERFORM setval('receipt_number_seq', n);
END $$;

-- Keep each variant's seeded stock: what the counter history sold was there before it.
INSERT INTO stock_movement (id, business_id, variant_id, delta, reason, by_user_id, by_name, note, at)
SELECT gen_random_uuid(), '22222222-2222-4222-8222-000000000001', c.variant_id, SUM(c.qty), 'RECEIVED',
       '11111111-1111-4111-8111-000000000001', 'Kry Sonita', 'Stock before counter history', now() - interval '32 days'
FROM counter_sold c
GROUP BY c.variant_id;
