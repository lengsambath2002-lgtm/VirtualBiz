-- Local-only demo data (enabled by the local and test profiles via classpath:db/seed-local).
-- Demo accounts from the prototypes; every password is Demo@1234 (BCrypt below).
-- Fixed UUIDs keep links stable between machines. Generated from frontend/src/lib/mock
-- (users.ts, seller.ts, provider.ts, marketplace.ts); later phases attach catalog data to
-- these businesses by slug.

-- ── Users ────────────────────────────────────────────────────────────────────────────
INSERT INTO users (id, name, email, phone, password_hash, created_at) VALUES
    ('11111111-1111-4111-8111-000000000001', 'Kry Sonita', 'nita@virtualbiz.com', '0968189261', '$2a$10$5fpQxsuz02pP7tvOMnk4UOR3EgOxDQ18.vGgcGZFbwCIt7W6TMIWu', now() - interval '400 days'),
    ('11111111-1111-4111-8111-000000000002', 'Dom Chheng', 'dom@virtualbiz.com', '012345678', '$2a$10$5fpQxsuz02pP7tvOMnk4UOR3EgOxDQ18.vGgcGZFbwCIt7W6TMIWu', now() - interval '120 days'),
    ('11111111-1111-4111-8111-000000000003', 'Try Dana', 'hello@glowbeauty.com.kh', '093828130', '$2a$10$5fpQxsuz02pP7tvOMnk4UOR3EgOxDQ18.vGgcGZFbwCIt7W6TMIWu', now() - interval '900 days'),
    ('11111111-1111-4111-8111-000000000011', 'Happy Coffee Owner', 'happy-coffee@shops.virtualbiz.com', NULL, '$2a$10$5fpQxsuz02pP7tvOMnk4UOR3EgOxDQ18.vGgcGZFbwCIt7W6TMIWu', make_date(2019, 1, 1)::timestamptz),
    ('11111111-1111-4111-8111-000000000012', 'King Techno Owner', 'king-techno@shops.virtualbiz.com', NULL, '$2a$10$5fpQxsuz02pP7tvOMnk4UOR3EgOxDQ18.vGgcGZFbwCIt7W6TMIWu', make_date(2015, 1, 1)::timestamptz),
    ('11111111-1111-4111-8111-000000000013', 'SK Fashion Owner', 'sk-fashion@shops.virtualbiz.com', NULL, '$2a$10$5fpQxsuz02pP7tvOMnk4UOR3EgOxDQ18.vGgcGZFbwCIt7W6TMIWu', make_date(2020, 1, 1)::timestamptz),
    ('11111111-1111-4111-8111-000000000014', 'Fresh Mart Owner', 'fresh-mart@shops.virtualbiz.com', NULL, '$2a$10$5fpQxsuz02pP7tvOMnk4UOR3EgOxDQ18.vGgcGZFbwCIt7W6TMIWu', make_date(2018, 1, 1)::timestamptz),
    ('11111111-1111-4111-8111-000000000015', 'Jasmine Spa Owner', 'jasmine-spa@shops.virtualbiz.com', NULL, '$2a$10$5fpQxsuz02pP7tvOMnk4UOR3EgOxDQ18.vGgcGZFbwCIt7W6TMIWu', make_date(2017, 1, 1)::timestamptz),
    ('11111111-1111-4111-8111-000000000016', 'Sambath Barber Owner', 'sambath-barber@shops.virtualbiz.com', NULL, '$2a$10$5fpQxsuz02pP7tvOMnk4UOR3EgOxDQ18.vGgcGZFbwCIt7W6TMIWu', make_date(2016, 1, 1)::timestamptz),
    ('11111111-1111-4111-8111-000000000017', 'FixIt Phnom Penh Owner', 'fixit-pp@shops.virtualbiz.com', NULL, '$2a$10$5fpQxsuz02pP7tvOMnk4UOR3EgOxDQ18.vGgcGZFbwCIt7W6TMIWu', make_date(2019, 1, 1)::timestamptz);

INSERT INTO user_sign_in_method (user_id, method) VALUES
    ('11111111-1111-4111-8111-000000000001', 'PASSWORD'),
    ('11111111-1111-4111-8111-000000000001', 'GOOGLE'),
    ('11111111-1111-4111-8111-000000000002', 'PASSWORD'),
    ('11111111-1111-4111-8111-000000000003', 'PASSWORD'),
    ('11111111-1111-4111-8111-000000000003', 'PHONE_SMS'),
    ('11111111-1111-4111-8111-000000000011', 'PASSWORD'),
    ('11111111-1111-4111-8111-000000000012', 'PASSWORD'),
    ('11111111-1111-4111-8111-000000000013', 'PASSWORD'),
    ('11111111-1111-4111-8111-000000000014', 'PASSWORD'),
    ('11111111-1111-4111-8111-000000000015', 'PASSWORD'),
    ('11111111-1111-4111-8111-000000000016', 'PASSWORD'),
    ('11111111-1111-4111-8111-000000000017', 'PASSWORD');

-- Kry Sonita's saved addresses (Customer prototype: Home default, Work).
INSERT INTO address (id, user_id, label, name, phone, line, district, note, is_default, created_at) VALUES
    ('44444444-4444-4444-8444-000000000001', '11111111-1111-4111-8111-000000000001', 'HOME', 'Kry Sonita', '0968189261', '#12, St. 516', 'Toul Kork', 'Blue gate, call on arrival', TRUE, now() - interval '300 days'),
    ('44444444-4444-4444-8444-000000000002', '11111111-1111-4111-8111-000000000001', 'WORK', 'Kry Sonita', '0968189261', 'Vattanac Tower, Floor 9', 'Daun Penh', 'Leave at reception', FALSE, now() - interval '200 days');

-- ── Businesses ───────────────────────────────────────────────────────────────────────
INSERT INTO business (id, owner_id, type, name, slug, category_id, about, phone, email, district, street, lat, lng, hours, closures, online, bakong_id, verification, rating, review_count, since, product_settings, booking_settings) VALUES
    ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000001', 'PRODUCT', 'Nita Gadget Store', 'nita-gadget', 'electronics',
     'Official-warranty phones, audio and accessories. Free setup and data transfer in store.',
     '0968189261', 'nita@nitagadget.com.kh', 'BKK1', '#45, St. 278', 11.553, 104.925,
     '[[540, 1200], [540, 1200], [540, 1200], [540, 1200], [540, 1200], [540, 1200], [600, 1080]]', '[]', TRUE, 'nitagadget@aba', 'VERIFIED', 4.2, 5, '2024-01-01T00:00:00Z',
     '{"autoAccept": false, "prepMinutes": 20, "lowStockDefault": 5, "pickup": true, "cod": true, "freeDeliveryOver": 25, "zones": [{"label": "BKK1 · Chamkar Mon · Daun Penh", "districts": ["BKK1", "Chamkar Mon", "Daun Penh"], "fee": 0.75}, {"label": "Toul Kork · Sen Sok · Russey Keo", "districts": ["Toul Kork", "Sen Sok", "Russey Keo"], "fee": 1.5}, {"label": "Chbar Ampov · Mean Chey · further", "districts": ["Chbar Ampov", "Mean Chey", "Por Senchey", "Prampi Makara"], "fee": 2.5}]}', NULL),
    ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-000000000003', 'SERVICE', 'Glow Beauty Salon', 'glow-beauty', 'beauty',
     'Hair, nails and make-up by a team of stylists. Walk-ins welcome when a chair is free.',
     '093828130', 'hello@glowbeauty.com.kh', 'Toul Kork', '#18A, St. 450', 11.574, 104.8945,
     '[[480, 1080], [480, 1080], [480, 1080], [480, 1080], [480, 1140], [480, 1140], null]', '[]', TRUE, 'glowbeauty@aba', 'VERIFIED', 4.7, 5, '2021-01-01T00:00:00Z',
     NULL, '{"onlineBooking": true, "autoConfirm": false, "reminderHours": 24, "minNoticeHours": 2, "freeCancelHours": 2, "bufferMinutes": 0}'),
    ('22222222-2222-4222-8222-000000000011', '11111111-1111-4111-8111-000000000011', 'PRODUCT', 'Happy Coffee', 'happy-coffee', 'cafe',
     'Single-origin Mondulkiri coffee, fresh pastries and cold brew. Roasted in-house every Monday.',
     '0969090234', NULL, 'Toul Kork', '#22, St. 315, Boeng Kak 1', 11.577, 104.9,
     '[[420, 1260], [420, 1260], [420, 1260], [420, 1260], [420, 1260], [420, 1260], [420, 1260]]', '[]', TRUE, 'happycoffee@aba', 'VERIFIED', 4.7, 12, '2019-01-01T00:00:00Z',
     '{"autoAccept": true, "prepMinutes": 20, "lowStockDefault": 5, "pickup": true, "cod": true, "freeDeliveryOver": 25, "zones": [{"label": "BKK1 · Chamkar Mon · Daun Penh", "districts": ["BKK1", "Chamkar Mon", "Daun Penh"], "fee": 0.75}, {"label": "Toul Kork · Sen Sok · Russey Keo", "districts": ["Toul Kork", "Sen Sok", "Russey Keo"], "fee": 1.5}, {"label": "Chbar Ampov · Mean Chey · further", "districts": ["Chbar Ampov", "Mean Chey", "Por Senchey", "Prampi Makara"], "fee": 2.5}]}', NULL),
    ('22222222-2222-4222-8222-000000000012', '11111111-1111-4111-8111-000000000012', 'PRODUCT', 'King Techno', 'king-techno', 'electronics',
     'Authorised reseller. Official warranty on every device, free setup and data transfer in store.',
     '012555818', NULL, 'BKK1', '#45, St. 278', 11.5525, 104.9255,
     '[[540, 1200], [540, 1200], [540, 1200], [540, 1200], [540, 1200], [540, 1200], [540, 1200]]', '[]', TRUE, 'kingtechno@aba', 'VERIFIED', 4.8, 12, '2015-01-01T00:00:00Z',
     '{"autoAccept": true, "prepMinutes": 45, "lowStockDefault": 5, "pickup": true, "cod": true, "freeDeliveryOver": 25, "zones": [{"label": "BKK1 · Chamkar Mon · Daun Penh", "districts": ["BKK1", "Chamkar Mon", "Daun Penh"], "fee": 0.75}, {"label": "Toul Kork · Sen Sok · Russey Keo", "districts": ["Toul Kork", "Sen Sok", "Russey Keo"], "fee": 1.5}, {"label": "Chbar Ampov · Mean Chey · further", "districts": ["Chbar Ampov", "Mean Chey", "Por Senchey", "Prampi Makara"], "fee": 2.5}]}', NULL),
    ('22222222-2222-4222-8222-000000000013', '11111111-1111-4111-8111-000000000013', 'PRODUCT', 'SK Fashion', 'sk-fashion', 'fashion',
     'Local cotton and Takeo silk, cut and sewn in Phnom Penh. Free alterations within 48 hours.',
     '077330441', NULL, 'Daun Penh', '#9, St. 13, Phsar Kandal', 11.572, 104.9285,
     '[[540, 1260], [540, 1260], [540, 1260], [540, 1260], [540, 1260], [540, 1260], [540, 1260]]', '[]', TRUE, 'skfashion@aba', 'VERIFIED', 4.7, 12, '2020-01-01T00:00:00Z',
     '{"autoAccept": true, "prepMinutes": 60, "lowStockDefault": 5, "pickup": true, "cod": true, "freeDeliveryOver": 25, "zones": [{"label": "BKK1 · Chamkar Mon · Daun Penh", "districts": ["BKK1", "Chamkar Mon", "Daun Penh"], "fee": 0.75}, {"label": "Toul Kork · Sen Sok · Russey Keo", "districts": ["Toul Kork", "Sen Sok", "Russey Keo"], "fee": 1.5}, {"label": "Chbar Ampov · Mean Chey · further", "districts": ["Chbar Ampov", "Mean Chey", "Por Senchey", "Prampi Makara"], "fee": 2.5}]}', NULL),
    ('22222222-2222-4222-8222-000000000014', '11111111-1111-4111-8111-000000000014', 'PRODUCT', 'Fresh Mart', 'fresh-mart', 'grocery',
     'Fresh produce from Kandal farms delivered daily. Rice, fruit, pantry staples.',
     '023218900', NULL, 'Chamkar Mon', '#101, Norodom Blvd', 11.548, 104.929,
     '[[360, 1320], [360, 1320], [360, 1320], [360, 1320], [360, 1320], [360, 1320], [360, 1320]]', '[]', TRUE, 'freshmart@aba', 'VERIFIED', 4.8, 12, '2018-01-01T00:00:00Z',
     '{"autoAccept": true, "prepMinutes": 30, "lowStockDefault": 5, "pickup": true, "cod": true, "freeDeliveryOver": 25, "zones": [{"label": "BKK1 · Chamkar Mon · Daun Penh", "districts": ["BKK1", "Chamkar Mon", "Daun Penh"], "fee": 0.75}, {"label": "Toul Kork · Sen Sok · Russey Keo", "districts": ["Toul Kork", "Sen Sok", "Russey Keo"], "fee": 1.5}, {"label": "Chbar Ampov · Mean Chey · further", "districts": ["Chbar Ampov", "Mean Chey", "Por Senchey", "Prampi Makara"], "fee": 2.5}]}', NULL),
    ('22222222-2222-4222-8222-000000000015', '11111111-1111-4111-8111-000000000015', 'SERVICE', 'Jasmine Spa', 'jasmine-spa', 'spa',
     'Khmer traditional and aromatherapy massage in a quiet garden house. Free parking.',
     '0969090234', NULL, 'Toul Kork', '#18A, St. 450, Boeng Kak 2', 11.5735, 104.893,
     '[[540, 1260], [540, 1260], [540, 1260], [540, 1260], [540, 1260], [540, 1260], [540, 1260]]', '[]', TRUE, 'jasminespa@aba', 'VERIFIED', 4.8, 12, '2017-01-01T00:00:00Z',
     NULL, '{"onlineBooking": true, "autoConfirm": true, "reminderHours": 24, "minNoticeHours": 1, "freeCancelHours": 2, "bufferMinutes": 0}'),
    ('22222222-2222-4222-8222-000000000016', '11111111-1111-4111-8111-000000000016', 'SERVICE', 'Sambath Barber', 'sambath-barber', 'salon',
     'Classic cuts, fades and hot-towel shaves. Walk-ins welcome before 11:00.',
     '089616202', NULL, 'Sen Sok', '#3, St. 1986, Phnom Penh Thmei', 11.5985, 104.865,
     '[[480, 1200], [480, 1200], [480, 1200], [480, 1200], [480, 1200], [480, 1200], [480, 1200]]', '[]', TRUE, 'sambathbarber@aba', 'VERIFIED', 4.9, 12, '2016-01-01T00:00:00Z',
     NULL, '{"onlineBooking": true, "autoConfirm": true, "reminderHours": 24, "minNoticeHours": 1, "freeCancelHours": 2, "bufferMinutes": 0}'),
    ('22222222-2222-4222-8222-000000000017', '11111111-1111-4111-8111-000000000017', 'SERVICE', 'FixIt Phnom Penh', 'fixit-pp', 'repair',
     'Phone screen and battery repair while you wait. 90-day warranty on parts.',
     '010404707', NULL, 'BKK1', '#7, St. 294', 11.555, 104.923,
     '[[540, 1140], [540, 1140], [540, 1140], [540, 1140], [540, 1140], [540, 1140], [540, 1140]]', '[]', TRUE, 'fixitpp@aba', 'VERIFIED', 4.7, 12, '2019-01-01T00:00:00Z',
     NULL, '{"onlineBooking": true, "autoConfirm": true, "reminderHours": 24, "minNoticeHours": 1, "freeCancelHours": 2, "bufferMinutes": 0}');

-- Owners (the creator of a business is its OWNER member).
INSERT INTO business_member (id, business_id, user_id, name, role, title, color) VALUES
    ('33333333-3333-4333-8333-000000000001', '22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000001', 'Kry Sonita', 'OWNER', 'Owner', NULL),
    ('33333333-3333-4333-8333-000000000002', '22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-000000000003', 'Try Dana', 'OWNER', 'Senior stylist', '#7C5CFA'),
    ('33333333-3333-4333-8333-000000000011', '22222222-2222-4222-8222-000000000011', '11111111-1111-4111-8111-000000000011', 'Happy Coffee Owner', 'OWNER', 'Owner', NULL),
    ('33333333-3333-4333-8333-000000000012', '22222222-2222-4222-8222-000000000012', '11111111-1111-4111-8111-000000000012', 'King Techno Owner', 'OWNER', 'Owner', NULL),
    ('33333333-3333-4333-8333-000000000013', '22222222-2222-4222-8222-000000000013', '11111111-1111-4111-8111-000000000013', 'SK Fashion Owner', 'OWNER', 'Owner', NULL),
    ('33333333-3333-4333-8333-000000000014', '22222222-2222-4222-8222-000000000014', '11111111-1111-4111-8111-000000000014', 'Fresh Mart Owner', 'OWNER', 'Owner', NULL),
    ('33333333-3333-4333-8333-000000000015', '22222222-2222-4222-8222-000000000015', '11111111-1111-4111-8111-000000000015', 'Jasmine Spa Owner', 'OWNER', 'Owner', NULL),
    ('33333333-3333-4333-8333-000000000016', '22222222-2222-4222-8222-000000000016', '11111111-1111-4111-8111-000000000016', 'Sambath Barber Owner', 'OWNER', 'Owner', NULL),
    ('33333333-3333-4333-8333-000000000017', '22222222-2222-4222-8222-000000000017', '11111111-1111-4111-8111-000000000017', 'FixIt Phnom Penh Owner', 'OWNER', 'Owner', NULL);
