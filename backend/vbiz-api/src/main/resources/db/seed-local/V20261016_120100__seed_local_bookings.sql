-- Local-only bookings data (local + test profiles via classpath:db/seed-local), from the Service
-- Provider mock before it was removed (frontend/src/lib/mock/provider.ts, provider-history.ts) and
-- the customer's demo booking (shop-shared seedHistory BK-02201). Times are relative to the
-- migration run (Phnom Penh calendar days). The 28-day history is generated here with the mock's
-- formulas so its weekdays always match the salon's hours.

-- ── Glow Beauty Salon: closures, retail items sold at checkout ──
UPDATE business SET closures = jsonb_build_array(
        jsonb_build_object('date', to_char((now() AT TIME ZONE 'Asia/Phnom_Penh')::date + 9, 'YYYY-MM-DD'), 'reason', 'Staff training'),
        jsonb_build_object('date', to_char((now() AT TIME ZONE 'Asia/Phnom_Penh')::date + 23, 'YYYY-MM-DD'), 'reason', 'Water Festival'))
WHERE id = '22222222-2222-4222-8222-000000000002';

-- In-store only (DRAFT keeps them out of the marketplace); the checkout sells them.
INSERT INTO product (id, business_id, slug, title, description, category_id, collection_id, status, options, specs, low_stock_at, sold_count, rating, position, created_at) VALUES
    ('aaaaaaaa-0000-4000-8000-000000000201', '22222222-2222-4222-8222-000000000002', 'glow-argan-oil', 'Argan hair oil 50 ml', '', 'beauty-products', NULL, 'DRAFT', '[]'::jsonb, '[]'::jsonb, 3, 0, 0, 0, now() - interval '60 days'),
    ('aaaaaaaa-0000-4000-8000-000000000202', '22222222-2222-4222-8222-000000000002', 'glow-cuticle-pen', 'Cuticle oil pen', '', 'beauty-products', NULL, 'DRAFT', '[]'::jsonb, '[]'::jsonb, 3, 0, 0, 1, now() - interval '60 days'),
    ('aaaaaaaa-0000-4000-8000-000000000203', '22222222-2222-4222-8222-000000000002', 'glow-shampoo', 'Colour-safe shampoo 250 ml', '', 'beauty-products', NULL, 'DRAFT', '[]'::jsonb, '[]'::jsonb, 3, 0, 0, 2, now() - interval '60 days');

INSERT INTO product_variant (id, product_id, business_id, option_values, price, compare_at, cost, sku, barcode, stock, swatch, position) VALUES
    ('bbbbbbbb-0000-4000-8000-000201000000', 'aaaaaaaa-0000-4000-8000-000000000201', '22222222-2222-4222-8222-000000000002', '[]'::jsonb, 12, NULL, NULL, 'GLOW-P1', '885200000001', 10, NULL, 0),
    ('bbbbbbbb-0000-4000-8000-000202000000', 'aaaaaaaa-0000-4000-8000-000000000202', '22222222-2222-4222-8222-000000000002', '[]'::jsonb, 5, NULL, NULL, 'GLOW-P2', '885200000002', 10, NULL, 0),
    ('bbbbbbbb-0000-4000-8000-000203000000', 'aaaaaaaa-0000-4000-8000-000000000203', '22222222-2222-4222-8222-000000000002', '[]'::jsonb, 9, NULL, NULL, 'GLOW-P3', '885200000003', 10, NULL, 0);

INSERT INTO stock_movement (id, business_id, variant_id, delta, reason, by_user_id, by_name, note, at) VALUES
    (gen_random_uuid(), '22222222-2222-4222-8222-000000000002', 'bbbbbbbb-0000-4000-8000-000201000000', 10, 'OPENING_STOCK', '11111111-1111-4111-8111-000000000003', 'Try Dana', NULL, now() - interval '60 days'),
    (gen_random_uuid(), '22222222-2222-4222-8222-000000000002', 'bbbbbbbb-0000-4000-8000-000202000000', 10, 'OPENING_STOCK', '11111111-1111-4111-8111-000000000003', 'Try Dana', NULL, now() - interval '60 days'),
    (gen_random_uuid(), '22222222-2222-4222-8222-000000000002', 'bbbbbbbb-0000-4000-8000-000203000000', 10, 'OPENING_STOCK', '11111111-1111-4111-8111-000000000003', 'Try Dana', NULL, now() - interval '60 days');

-- ── Clients (glow-c0 … glow-c14); a client whose phone is a VirtualBiz account is linked to it ──
INSERT INTO client (id, business_id, user_id, name, phone, email, note, since)
SELECT ('dddddddd-0000-4000-8000-0000000001' || lpad(c.i::text, 2, '0'))::uuid,
       '22222222-2222-4222-8222-000000000002',
       (SELECT u.id FROM users u WHERE u.phone = c.phone),
       c.name, c.phone,
       CASE WHEN c.i % 3 <> 0 THEN lower(replace(c.name, ' ', '.')) || '@gmail.com' END,
       (ARRAY['Prefers Vicheka. Sensitive scalp.', NULL, 'Always 10 min early.', NULL,
              'Allergic to some gel brands — patch test.', NULL])[c.i % 6 + 1],
       now() - make_interval(days => 40 + c.i * 23)
FROM (VALUES (0, 'Chav Rada', '096382813'), (1, 'Jane Cooper', '012445900'), (2, 'Chan Mithona', '088720114'),
             (3, 'Sokha Chan', '017221660'), (4, 'Dara Vann', '098334120'), (5, 'Sreypov Kim', '015900223'),
             (6, 'Pisey Sorn', '070118772'), (7, 'Vannak Heng', '089554210'), (8, 'Rithy Thon', '097662001'),
             (9, 'Tena Heng', '061330448'), (10, 'Leakhena Ouk', '069412375'), (11, 'Bopha Meas', '092818404'),
             (12, 'Monika Lim', '011707303'), (13, 'Sophal Keo', '085223909'), (14, 'Kanha Seng', '016404515'))
     AS c (i, name, phone);

-- ── Appointments and sales ──
DO $$
DECLARE
    biz      CONSTANT uuid := '22222222-2222-4222-8222-000000000002';
    today    CONSTANT date := (now() AT TIME ZONE 'Asia/Phnom_Penh')::date;
    -- services in the mock's order: id, duration, price, staff (dana / leak / vicheka)
    svc_ids  uuid[] := ARRAY['cccccccc-0000-4000-8000-000000000008', 'cccccccc-0000-4000-8000-000000000009',
                             'cccccccc-0000-4000-8000-000000000010', 'cccccccc-0000-4000-8000-000000000011',
                             'cccccccc-0000-4000-8000-000000000012', 'cccccccc-0000-4000-8000-000000000013',
                             'cccccccc-0000-4000-8000-000000000014', 'cccccccc-0000-4000-8000-000000000015']::uuid[];
    svc_dur  int[] := ARRAY[45, 30, 120, 150, 45, 60, 60, 60];
    svc_px   numeric[] := ARRAY[8, 5, 35, 55, 12, 18, 15, 30];
    svc_name text[] := ARRAY['Haircut & Style', 'Wash & Blow-dry', 'Hair Colouring', 'Keratin Treatment',
                             'Nail Colouring', 'Gel Manicure', 'Spa Pedicure', 'Event Make-up'];
    -- staff per service as indexes into staff_ids (1 dana, 2 leak, 3 vicheka)
    svc_staff text[] := ARRAY['1,3', '1,3', '3', '3', '2', '2', '2', '1'];
    staff_ids uuid[] := ARRAY['33333333-3333-4333-8333-000000000002', '33333333-3333-4333-8333-000000000101',
                              '33333333-3333-4333-8333-000000000102']::uuid[];
    -- shifts [staff][dow 0..6, Monday first] as "open,close" hours or '' when off
    shifts text[][] := ARRAY[
        ARRAY['8,17', '8,17', '8,17', '8,17', '8,19', '9,19', ''],
        ARRAY['9,18', '9,18', '', '9,18', '9,18', '8,18', ''],
        ARRAY['10,18', '10,18', '10,18', '', '10,19', '8,19', '']];
    open_days boolean[] := ARRAY[true, true, true, true, true, true, false];
    sources text[] := ARRAY['ONLINE', 'ONLINE', 'PHONE', 'WALK_IN'];
    pays text[] := ARRAY['CASH', 'KHQR', 'KHQR', 'CARD'];
    seq int := 4100;
    num int := 3000;
    sale_num int := 3000;
    d int; k int; n int; w int; si int; st int; sh text; sh0 int; sh1 int; dur int; s_start int;
    status text; src text; proto text; dt date; appt uuid; sale uuid; tip numeric; method text;
    staff_list text[]; client uuid; created timestamptz;
BEGIN
    -- History: the last 28 days (provider-history.ts build()).
    FOR d IN REVERSE 28..1 LOOP
        dt := today - d;
        w := extract(isodow FROM dt)::int - 1;
        CONTINUE WHEN NOT open_days[w + 1];
        n := 3 + ((d * 7) % 4);
        FOR k IN 0..n - 1 LOOP
            si := ((d + k * 3) % 8) + 1;
            staff_list := string_to_array(svc_staff[si], ',');
            st := staff_list[((d + k) % array_length(staff_list, 1)) + 1]::int;
            sh := shifts[st][w + 1];
            CONTINUE WHEN sh = '';
            sh0 := split_part(sh, ',', 1)::int * 60;
            sh1 := split_part(sh, ',', 2)::int * 60;
            dur := svc_dur[si];
            s_start := round((sh0 + ((k * 105 + d * 15) % (sh1 - sh0 - dur)))::numeric / 15) * 15;
            status := CASE WHEN (d * 3 + k) % 13 = 0 THEN 'NO_SHOW'
                           WHEN (d + k * 5) % 11 = 0 THEN 'CANCELLED' ELSE 'COMPLETED' END;
            src := sources[((d + k) % 4) + 1];
            seq := seq + 1;
            proto := 'A' || seq;
            num := num + 1;
            appt := md5('glow-h' || seq)::uuid;
            client := ('dddddddd-0000-4000-8000-0000000001' || lpad(((d + k * 4) % 15)::text, 2, '0'))::uuid;
            created := now() - make_interval(hours => (d + 1) * 5);
            INSERT INTO appointment (id, number, business_id, client_id, service_id, staff_id, date, start_min,
                                     duration_min, price, status, source, cancel_reason, created_at)
            VALUES (appt, 'BK-' || lpad(num::text, 5, '0'), biz, client, svc_ids[si], staff_ids[st], dt, s_start,
                    dur, svc_px[si], status, src, CASE WHEN status = 'CANCELLED' THEN 'clientAsked' END, created);
            INSERT INTO appointment_event (id, appointment_id, code, params, at)
            VALUES (gen_random_uuid(), appt, CASE src WHEN 'ONLINE' THEN 'bookedOnline' WHEN 'PHONE' THEN 'bookedPhone'
                                                       ELSE 'bookedWalkin' END, '{}'::jsonb, created);
            IF status = 'COMPLETED' THEN
                tip := ascii(substr(proto, 4, 1)) % 3;
                method := pays[(ascii(substr(proto, 5, 1)) % 4) + 1];
                seq := seq + 1;
                sale_num := sale_num + 1;
                sale := md5('glow-hs' || seq)::uuid;
                INSERT INTO sale (id, number, business_id, appointment_id, client_id, subtotal, discount, tip, total,
                                  by_user_id, by_name, at)
                VALUES (sale, 'S-' || lpad(sale_num::text, 5, '0'), biz, appt, client, svc_px[si], 0, tip,
                        svc_px[si] + tip, '11111111-1111-4111-8111-000000000003', 'Try Dana',
                        ((dt + make_interval(mins => s_start + dur))::timestamp AT TIME ZONE 'Asia/Phnom_Penh'));
                INSERT INTO sale_line (id, sale_id, position, service_id, title, qty, unit_price, staff_id)
                VALUES (gen_random_uuid(), sale, 0, svc_ids[si], svc_name[si], 1, svc_px[si], staff_ids[st]);
                INSERT INTO sale_payment (id, sale_id, position, method, amount)
                VALUES (gen_random_uuid(), sale, 0, method, svc_px[si] + tip);
                UPDATE appointment SET sale_id = sale WHERE id = appt;
                INSERT INTO appointment_event (id, appointment_id, code, params, at)
                VALUES (gen_random_uuid(), appt, 'paid',
                        jsonb_build_object('amount', to_char(svc_px[si] + tip, 'FM999990.00'), 'method', method),
                        ((dt + make_interval(mins => s_start + dur))::timestamp AT TIME ZONE 'Asia/Phnom_Penh'));
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- Today, upcoming and the open requests (provider.ts mk()): client, service, staff, day, time,
-- status, source, note, minutes since it was booked. Numbers BK-04101 … in the mock's order.
CREATE TEMP TABLE glow_now (pos int, client int, svc int, staff int, day int, at_min int, status text,
                            source text, note text, created_min int) ON COMMIT DROP;
INSERT INTO glow_now VALUES
    (1, 0, 1, 1, 0, 510, 'COMPLETED', 'PHONE', NULL, 300),
    (2, 2, 2, 3, 0, 600, 'COMPLETED', 'ONLINE', NULL, 300),
    (3, 3, 5, 2, 0, 660, 'STARTED', 'ONLINE', NULL, 300),
    (4, 5, 3, 3, 0, 780, 'CONFIRMED', 'PHONE', 'Highlights, not full colour.', 300),
    (5, 7, 1, 1, 0, 840, 'BOOKED', 'ONLINE', NULL, 300),
    (6, 11, 6, 2, 0, 900, 'CONFIRMED', 'ONLINE', NULL, 300),
    (7, 12, 8, 1, 0, 960, 'BOOKED', 'PHONE', NULL, 300),
    (8, 13, 7, 2, 0, 990, 'CONFIRMED', 'ONLINE', NULL, 300),
    (9, 1, 1, 1, 1, 540, 'CONFIRMED', 'ONLINE', NULL, 600),
    (10, 8, 6, 2, 1, 630, 'BOOKED', 'ONLINE', NULL, 600),
    (11, 9, 3, 3, 1, 780, 'CONFIRMED', 'ONLINE', NULL, 600),
    (12, 4, 2, 1, 2, 660, 'BOOKED', 'ONLINE', NULL, 900),
    (13, 6, 5, 2, 2, 840, 'CONFIRMED', 'ONLINE', NULL, 900),
    (14, 10, 1, 3, 3, 930, 'BOOKED', 'ONLINE', NULL, 1200),
    (15, 14, 8, 1, 4, 570, 'BOOKED', 'ONLINE', NULL, 1500),
    (16, 1, 1, 1, 0, 1020, 'REQUESTED', 'ONLINE', 'First time. Wants a short bob.', 25),
    (17, 4, 3, 3, 1, 570, 'REQUESTED', 'ONLINE', NULL, 120),
    (18, 6, 6, 2, 1, 630, 'REQUESTED', 'ONLINE', NULL, 300);

INSERT INTO appointment (id, number, business_id, client_id, service_id, staff_id, date, start_min, duration_min,
                         price, status, source, note, created_at)
SELECT md5('glow-a' || g.pos)::uuid, 'BK-0' || (4100 + g.pos), '22222222-2222-4222-8222-000000000002',
       ('dddddddd-0000-4000-8000-0000000001' || lpad(g.client::text, 2, '0'))::uuid, s.id, m.id,
       (now() AT TIME ZONE 'Asia/Phnom_Penh')::date + g.day, g.at_min, s.duration_min, s.price, g.status, g.source,
       g.note, now() - make_interval(mins => g.created_min)
FROM glow_now g
JOIN service s ON s.id = ('cccccccc-0000-4000-8000-0000000000' || lpad((7 + g.svc)::text, 2, '0'))::uuid
JOIN business_member m ON m.id = (ARRAY['33333333-3333-4333-8333-000000000002', '33333333-3333-4333-8333-000000000101',
                                        '33333333-3333-4333-8333-000000000102'])[g.staff]::uuid;

INSERT INTO appointment_event (id, appointment_id, code, params, at)
SELECT gen_random_uuid(), md5('glow-a' || g.pos)::uuid,
       CASE g.source WHEN 'ONLINE' THEN 'bookedOnline' WHEN 'PHONE' THEN 'bookedPhone' ELSE 'bookedWalkin' END,
       '{}'::jsonb, now() - make_interval(mins => g.created_min)
FROM glow_now g;

-- Today's two finished appointments were paid (tip = position − 1; cash, then KHQR).
INSERT INTO sale (id, number, business_id, appointment_id, client_id, subtotal, discount, tip, total, by_user_id, by_name, at)
SELECT md5('glow-s' || a.number)::uuid, 'S-0' || (4100 + g.pos), a.business_id, a.id, a.client_id, a.price, 0,
       g.pos - 1, a.price + g.pos - 1, '11111111-1111-4111-8111-000000000003', 'Try Dana',
       (a.date + make_interval(mins => a.start_min + a.duration_min))::timestamp AT TIME ZONE 'Asia/Phnom_Penh'
FROM glow_now g JOIN appointment a ON a.id = md5('glow-a' || g.pos)::uuid
WHERE g.status = 'COMPLETED';

INSERT INTO sale_line (id, sale_id, position, service_id, title, qty, unit_price, staff_id)
SELECT gen_random_uuid(), md5('glow-s' || a.number)::uuid, 0, a.service_id, s.name, 1, a.price, a.staff_id
FROM glow_now g JOIN appointment a ON a.id = md5('glow-a' || g.pos)::uuid JOIN service s ON s.id = a.service_id
WHERE g.status = 'COMPLETED';

INSERT INTO sale_payment (id, sale_id, position, method, amount)
SELECT gen_random_uuid(), md5('glow-s' || a.number)::uuid, 0, CASE WHEN g.pos = 1 THEN 'CASH' ELSE 'KHQR' END,
       a.price + g.pos - 1
FROM glow_now g JOIN appointment a ON a.id = md5('glow-a' || g.pos)::uuid
WHERE g.status = 'COMPLETED';

UPDATE appointment a SET sale_id = md5('glow-s' || a.number)::uuid
FROM glow_now g WHERE a.id = md5('glow-a' || g.pos)::uuid AND g.status = 'COMPLETED';

INSERT INTO appointment_event (id, appointment_id, code, params, at)
SELECT gen_random_uuid(), a.id, 'paid',
       jsonb_build_object('amount', to_char(a.price + g.pos - 1, 'FM999990.00'),
                          'method', CASE WHEN g.pos = 1 THEN 'CASH' ELSE 'KHQR' END),
       (a.date + make_interval(mins => a.start_min + a.duration_min))::timestamp AT TIME ZONE 'Asia/Phnom_Penh'
FROM glow_now g JOIN appointment a ON a.id = md5('glow-a' || g.pos)::uuid
WHERE g.status = 'COMPLETED';

-- Online bookings of clients who have an account show in that customer's "My bookings".
UPDATE appointment a SET customer_id = c.user_id
FROM client c WHERE a.client_id = c.id AND a.source = 'ONLINE' AND c.user_id IS NOT NULL;

-- Lunch breaks today.
INSERT INTO calendar_block (id, business_id, staff_id, date, start_min, duration_min, reason) VALUES
    (gen_random_uuid(), '22222222-2222-4222-8222-000000000002', '33333333-3333-4333-8333-000000000002',
     (now() AT TIME ZONE 'Asia/Phnom_Penh')::date, 720, 60, 'LUNCH'),
    (gen_random_uuid(), '22222222-2222-4222-8222-000000000002', '33333333-3333-4333-8333-000000000101',
     (now() AT TIME ZONE 'Asia/Phnom_Penh')::date, 750, 45, 'LUNCH');

-- ── Kry Sonita's upcoming haircut at Sambath Barber (the customer prototype's BK-02201) ──
INSERT INTO client (id, business_id, user_id, name, phone, email, since) VALUES
    ('dddddddd-0000-4000-8000-000000000201', '22222222-2222-4222-8222-000000000016',
     '11111111-1111-4111-8111-000000000001', 'Kry Sonita', '0968189261', 'nita@virtualbiz.com', now() - interval '90 days');

INSERT INTO appointment (id, number, business_id, client_id, customer_id, service_id, staff_id, date, start_min,
                         duration_min, price, status, source, created_at) VALUES
    (md5('bk-02201')::uuid, 'BK-02201', '22222222-2222-4222-8222-000000000016', 'dddddddd-0000-4000-8000-000000000201',
     '11111111-1111-4111-8111-000000000001', 'cccccccc-0000-4000-8000-000000000004', '33333333-3333-4333-8333-000000000106',
     (now() AT TIME ZONE 'Asia/Phnom_Penh')::date + 3, 630, 30, 6, 'BOOKED', 'ONLINE', now() - interval '2 days');

INSERT INTO appointment_event (id, appointment_id, code, params, at) VALUES
    (gen_random_uuid(), md5('bk-02201')::uuid, 'bookedOnline', '{}'::jsonb, now() - interval '2 days');

-- ── The salon's inbox: the newest request and the latest unanswered 5-star / low reviews ──
INSERT INTO notification (id, business_id, kind, params, route, unread, at)
SELECT gen_random_uuid(), a.business_id, 'BOOKING_REQUESTED',
       jsonb_build_object('number', a.number, 'name', c.name, 'service', s.name, 'date', a.date::text,
                          'time', to_char(make_time(a.start_min / 60, a.start_min % 60, 0), 'HH24:MI')),
       '/provider/calendar?date=' || a.date || '&appt=' || a.id, TRUE, a.created_at
FROM appointment a JOIN client c ON c.id = a.client_id JOIN service s ON s.id = a.service_id
WHERE a.id = md5('glow-a16')::uuid;

INSERT INTO notification (id, business_id, kind, params, route, unread, at)
SELECT gen_random_uuid(), r.business_id, 'NEW_REVIEW',
       jsonb_build_object('name', r.author_name, 'stars', r.stars::text), '/provider/marketing?tab=reviews',
       r.stars = 5, r.at
FROM (SELECT DISTINCT ON (r.stars = 5) r.*
      FROM review r
      WHERE r.business_id = '22222222-2222-4222-8222-000000000002'
        AND ((r.stars = 5 AND r.reply IS NULL) OR r.stars <= 3)
      ORDER BY r.stars = 5, r.at DESC) r;

-- BK- and S- numbers continue after the seed.
SELECT setval('booking_number_seq', 4200);
SELECT setval('sale_number_seq', 4200);
