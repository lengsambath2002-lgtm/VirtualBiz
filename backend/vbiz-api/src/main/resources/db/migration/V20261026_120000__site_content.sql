-- Site content a super-admin edits in the console (docs/api/site-content.md): the marketplace
-- homepage banners and the Terms and Privacy pages, in English and Khmer. One row per document;
-- the body is checked by the API (meta.service.SiteContentService). Every change is in admin_audit.
CREATE TABLE site_content (
    key         VARCHAR(40)  PRIMARY KEY CHECK (key IN ('home-banners', 'terms', 'privacy')),
    body        JSONB        NOT NULL,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by  VARCHAR(80)
);

-- The homepage as it was (shop.home.* messages): the main banner and the two beside it.
INSERT INTO site_content (key, body) VALUES ('home-banners', jsonb_build_object(
    'main', jsonb_build_object(
        'visible', true,
        'eyebrow', jsonb_build_object('en', 'Water Festival week', 'kh', 'សប្តាហ៍បុណ្យអុំទូក'),
        'title', jsonb_build_object('en', 'Order from local shops, delivered in about 30 minutes',
            'kh', 'កុម្ម៉ង់ពីហាងក្នុងស្រុក ដឹកដល់ក្នុងរយៈពេលប្រហែល 30 នាទី'),
        'body', jsonb_build_object('en', 'Use code **WATERFEST** for 10% off, up to $5. Pay with KHQR or cash.',
            'kh', 'ប្រើកូដ **WATERFEST** ដើម្បីបញ្ចុះ 10% រហូតដល់ $5។ បង់តាម KHQR ឬសាច់ប្រាក់។'),
        'cta', jsonb_build_object('en', 'See this week''s deals', 'kh', 'មើលប្រូម៉ូសិនសប្តាហ៍នេះ'),
        'href', '/deals'),
    'side1', jsonb_build_object(
        'visible', true,
        'eyebrow', jsonb_build_object('en', 'Book a service', 'kh', 'កក់សេវាកម្ម'),
        'title', jsonb_build_object('en', 'Spa, salon or phone repair. Pick a time that suits you.',
            'kh', 'ស្ប៉ា ហាងសក់ ឬជួសជុលទូរស័ព្ទ។ ជ្រើសម៉ោងដែលស្រួលសម្រាប់អ្នក។'),
        'body', jsonb_build_object('en', 'Free cancellation up to 2 h before',
            'kh', 'បោះបង់ដោយឥតគិតថ្លៃ រហូតដល់ 2 ម៉ោងមុន'),
        'cta', jsonb_build_object('en', '', 'kh', ''),
        'href', '/search?type=service'),
    'side2', jsonb_build_object(
        'visible', true,
        'eyebrow', jsonb_build_object('en', 'For business', 'kh', 'សម្រាប់អាជីវកម្ម'),
        'title', jsonb_build_object('en', 'Sell or take bookings on VirtualBiz',
            'kh', 'លក់ ឬទទួលការកក់នៅលើ VirtualBiz'),
        'body', jsonb_build_object('en', 'Set up your shop in 2 minutes',
            'kh', 'រៀបចំហាងរបស់អ្នកក្នុងរយៈពេល 2 នាទី'),
        'cta', jsonb_build_object('en', '', 'kh', ''),
        'href', '/create-business')));

-- A starting text for each page. "## " starts a heading, "- " a bullet, a blank line a paragraph.
INSERT INTO site_content (key, body) VALUES ('terms', jsonb_build_object('en', $en$
These terms apply when you use VirtualBiz: the marketplace, and the tools shops and service providers use to sell and take bookings. By creating an account or placing an order you agree to them.

## Your account
- Give your real name and an email address or phone number you can reach.
- Keep your password and sign-in codes to yourself. You are responsible for what happens in your account.
- You must be 16 or older, or use VirtualBiz with a parent or guardian.

## Buying and booking
- Each shop or provider sells its own products and services. They set the price, describe what they sell and deliver it.
- Prices are in US dollars; the riel amount shown next to them is a guide.
- An order is confirmed when the shop accepts it. A booking is confirmed when the provider confirms it.
- You can cancel a booking free of charge until the time the provider shows. Returns follow the shop's return policy, shown on its page and receipt.

## Payments
- You can pay online with KHQR or a card, or pay cash where the shop allows it.
- Online payments go through VirtualBiz, which passes them on to the shop after delivery, less its commission.
- If an order is cancelled or returned, the refund goes back the way you paid.

## Selling on VirtualBiz
- Shops must sell only what they are allowed to sell in Cambodia, describe it honestly and keep stock and opening hours up to date.
- Before payouts start, the owner's ID is checked. VirtualBiz may suspend a shop that breaks these terms.
- VirtualBiz keeps a commission on each order paid online; the current rate is shown in the shop's payouts.

## Reviews and content
- Reviews must be about a real order or booking. We may hide reviews that are abusive, fake or off topic.
- You keep the rights to photos and text you upload and let VirtualBiz show them on the service.

## Things you must not do
- Break the law, mislead customers or shops, or sell banned goods.
- Try to get into other people's accounts or disrupt the service.

## Liability
VirtualBiz connects customers with shops and providers. As far as the law allows, we are not responsible for the products or services they sell, and our liability for anything else is limited to the fees you paid us.

## Changes and contact
We may update these terms. When we do, we change the date at the top of this page; important changes are also sent by email. Questions: use the Help page.
$en$, 'kh', $kh$
លក្ខខណ្ឌទាំងនេះអនុវត្តនៅពេលអ្នកប្រើ VirtualBiz៖ ទីផ្សារ និងឧបករណ៍ដែលហាង និងអ្នកផ្តល់សេវាប្រើដើម្បីលក់ និងទទួលការកក់។ ដោយបង្កើតគណនី ឬធ្វើការបញ្ជាទិញ អ្នកយល់ព្រមតាមលក្ខខណ្ឌទាំងនេះ។

## គណនីរបស់អ្នក
- សូមផ្តល់ឈ្មោះពិត និងអាសយដ្ឋានអ៊ីមែល ឬលេខទូរស័ព្ទដែលអាចទាក់ទងបាន។
- រក្សាពាក្យសម្ងាត់ និងលេខកូដចូលជាការសម្ងាត់។ អ្នកទទួលខុសត្រូវចំពោះអ្វីដែលកើតឡើងក្នុងគណនីរបស់អ្នក។
- អ្នកត្រូវមានអាយុ 16 ឆ្នាំឡើងទៅ ឬប្រើ VirtualBiz ជាមួយឪពុកម្តាយ ឬអាណាព្យាបាល។

## ការទិញ និងការកក់
- ហាង ឬអ្នកផ្តល់សេវានីមួយៗលក់ផលិតផល និងសេវាកម្មផ្ទាល់ខ្លួន។ ពួកគេកំណត់តម្លៃ ពិពណ៌នាអ្វីដែលពួកគេលក់ និងប្រគល់ជូន។
- តម្លៃគិតជាដុល្លារអាមេរិក ចំនួនប្រាក់រៀលដែលបង្ហាញក្បែរនោះសម្រាប់ជាការណែនាំ។
- ការបញ្ជាទិញត្រូវបានបញ្ជាក់នៅពេលហាងទទួលយក។ ការកក់ត្រូវបានបញ្ជាក់នៅពេលអ្នកផ្តល់សេវាបញ្ជាក់។
- អ្នកអាចលុបចោលការកក់ដោយឥតគិតថ្លៃរហូតដល់ពេលវេលាដែលអ្នកផ្តល់សេវាបង្ហាញ។ ការប្តូរយកវិញអនុវត្តតាមគោលការណ៍របស់ហាង ដែលបង្ហាញនៅលើទំព័រ និងបង្កាន់ដៃរបស់ហាង។

## ការបង់ប្រាក់
- អ្នកអាចបង់ប្រាក់តាមអនឡាញដោយ KHQR ឬកាត ឬបង់ជាសាច់ប្រាក់ ប្រសិនបើហាងអនុញ្ញាត។
- ការបង់ប្រាក់តាមអនឡាញឆ្លងកាត់ VirtualBiz ដែលផ្ទេរទៅហាងបន្ទាប់ពីការដឹកជញ្ជូន ដោយកាត់កម្រៃជើងសារ។
- ប្រសិនបើការបញ្ជាទិញត្រូវបានលុបចោល ឬប្តូរយកវិញ ប្រាក់សងត្រឡប់ទៅតាមវិធីដែលអ្នកបានបង់។

## ការលក់នៅលើ VirtualBiz
- ហាងត្រូវលក់តែទំនិញដែលអនុញ្ញាតឱ្យលក់នៅកម្ពុជា ពិពណ៌នាដោយស្មោះត្រង់ និងធ្វើបច្ចុប្បន្នភាពស្តុក និងម៉ោងបើក។
- មុនពេលចាប់ផ្តើមផ្ទេរប្រាក់ អត្តសញ្ញាណប័ណ្ណរបស់ម្ចាស់ត្រូវបានពិនិត្យ។ VirtualBiz អាចផ្អាកហាងដែលបំពានលក្ខខណ្ឌទាំងនេះ។
- VirtualBiz រក្សាកម្រៃជើងសារលើការបញ្ជាទិញនីមួយៗដែលបង់តាមអនឡាញ អត្រាបច្ចុប្បន្នបង្ហាញក្នុងការផ្ទេរប្រាក់របស់ហាង។

## ការវាយតម្លៃ និងខ្លឹមសារ
- ការវាយតម្លៃត្រូវតែទាក់ទងនឹងការបញ្ជាទិញ ឬការកក់ពិតប្រាកដ។ យើងអាចលាក់ការវាយតម្លៃដែលប្រមាថ ក្លែងក្លាយ ឬមិនពាក់ព័ន្ធ។
- អ្នករក្សាសិទ្ធិលើរូបថត និងអត្ថបទដែលអ្នកផ្ទុកឡើង ហើយអនុញ្ញាតឱ្យ VirtualBiz បង្ហាញវានៅលើសេវាកម្ម។

## អ្វីដែលអ្នកមិនត្រូវធ្វើ
- បំពានច្បាប់ បញ្ឆោតអតិថិជន ឬហាង ឬលក់ទំនិញហាមឃាត់។
- ព្យាយាមចូលគណនីអ្នកដទៃ ឬរំខានដល់សេវាកម្ម។

## ការទទួលខុសត្រូវ
VirtualBiz ភ្ជាប់អតិថិជនជាមួយហាង និងអ្នកផ្តល់សេវា។ តាមដែលច្បាប់អនុញ្ញាត យើងមិនទទួលខុសត្រូវចំពោះផលិតផល ឬសេវាកម្មដែលពួកគេលក់ទេ ហើយការទទួលខុសត្រូវរបស់យើងចំពោះអ្វីផ្សេងទៀតត្រូវបានកំណត់ត្រឹមកម្រៃដែលអ្នកបានបង់ឱ្យយើង។

## ការផ្លាស់ប្តូរ និងទំនាក់ទំនង
យើងអាចធ្វើបច្ចុប្បន្នភាពលក្ខខណ្ឌទាំងនេះ។ នៅពេលនោះ យើងប្តូរកាលបរិច្ឆេទនៅខាងលើទំព័រនេះ ការផ្លាស់ប្តូរសំខាន់ៗក៏ត្រូវបានផ្ញើតាមអ៊ីមែលផងដែរ។ សំណួរ៖ សូមប្រើទំព័រជំនួយ។
$kh$));

INSERT INTO site_content (key, body) VALUES ('privacy', jsonb_build_object('en', $en$
This policy explains what VirtualBiz collects about you, why, and the choices you have.

## What we collect
- Account details: your name, email address, phone number, password (stored only as a one-way hash) and profile photos.
- Orders and bookings: what you bought or booked, delivery addresses, and messages with shops.
- Payments: the amount and status of each payment. Card numbers and bank details are handled by the payment provider, not stored by VirtualBiz.
- Shops: the owner's ID photo for the identity check, and the Bakong account payouts go to.
- Technical data: the device and browser you use, sign-in times and an approximate location from your IP address, to keep accounts safe.

## How we use it
- To run your orders, bookings, deliveries and payouts.
- To send you sign-in codes, receipts and the notifications you choose (Your account → Settings).
- To keep VirtualBiz safe: spotting fraud, locking accounts after too many wrong passwords, and two-step sign-in.
- To improve the service, using totals that don't name you.

## Who sees it
- The shop or provider you order from or book with sees your name, phone number, address and what you ordered.
- Service providers that run parts of VirtualBiz for us: hosting, email, sign-in (Google Firebase), push notifications and payments. They may only use it to do that work.
- Authorities, when the law requires it.
We never sell your personal data.

## How long we keep it
We keep your account while you use it. Order and payment records are kept as long as tax and accounting law requires. Sign-in codes expire after 10 minutes.

## Your choices
- Change your details, password and notification choices in Your account.
- Turn on two-step sign-in for extra protection.
- Ask for a copy of your data, or for your account to be deleted, through the Help page.

## Security
Passwords are hashed, connections are encrypted, and sensitive details such as ID photos are kept private. No system is perfectly secure, so please use a strong password and two-step sign-in.

## Changes and contact
We may update this policy and will change the date at the top of this page when we do. Questions about your data: use the Help page.
$en$, 'kh', $kh$
គោលការណ៍នេះពន្យល់ពីអ្វីដែល VirtualBiz ប្រមូលអំពីអ្នក មូលហេតុ និងជម្រើសដែលអ្នកមាន។

## អ្វីដែលយើងប្រមូល
- ព័ត៌មានគណនី៖ ឈ្មោះ អាសយដ្ឋានអ៊ីមែល លេខទូរស័ព្ទ ពាក្យសម្ងាត់ (រក្សាទុកតែជាទម្រង់ hash ម្ខាង) និងរូបថតប្រវត្តិរូប។
- ការបញ្ជាទិញ និងការកក់៖ អ្វីដែលអ្នកបានទិញ ឬកក់ អាសយដ្ឋានដឹកជញ្ជូន និងសារជាមួយហាង។
- ការបង់ប្រាក់៖ ចំនួន និងស្ថានភាពនៃការបង់ប្រាក់នីមួយៗ។ លេខកាត និងព័ត៌មានធនាគារត្រូវបានគ្រប់គ្រងដោយអ្នកផ្តល់សេវាបង់ប្រាក់ មិនមែនរក្សាទុកដោយ VirtualBiz ទេ។
- ហាង៖ រូបថតអត្តសញ្ញាណប័ណ្ណរបស់ម្ចាស់សម្រាប់ការផ្ទៀងផ្ទាត់ និងគណនី Bakong ដែលទទួលការផ្ទេរប្រាក់។
- ទិន្នន័យបច្ចេកទេស៖ ឧបករណ៍ និងកម្មវិធីរុករកដែលអ្នកប្រើ ពេលវេលាចូល និងទីតាំងប្រហាក់ប្រហែលពីអាសយដ្ឋាន IP ដើម្បីរក្សាសុវត្ថិភាពគណនី។

## របៀបដែលយើងប្រើ
- ដើម្បីដំណើរការការបញ្ជាទិញ ការកក់ ការដឹកជញ្ជូន និងការផ្ទេរប្រាក់របស់អ្នក។
- ដើម្បីផ្ញើលេខកូដចូល បង្កាន់ដៃ និងការជូនដំណឹងដែលអ្នកជ្រើសរើស (គណនីរបស់អ្នក → ការកំណត់)។
- ដើម្បីរក្សាសុវត្ថិភាព VirtualBiz៖ រកមើលការក្លែងបន្លំ ចាក់សោគណនីបន្ទាប់ពីពាក្យសម្ងាត់ខុសច្រើនដង និងការចូលពីរជំហាន។
- ដើម្បីកែលម្អសេវាកម្ម ដោយប្រើតួលេខសរុបដែលមិនបញ្ចេញឈ្មោះអ្នក។

## អ្នកណាឃើញវា
- ហាង ឬអ្នកផ្តល់សេវាដែលអ្នកបញ្ជាទិញ ឬកក់ ឃើញឈ្មោះ លេខទូរស័ព្ទ អាសយដ្ឋាន និងអ្វីដែលអ្នកបានបញ្ជាទិញ។
- អ្នកផ្តល់សេវាដែលដំណើរការផ្នែកខ្លះនៃ VirtualBiz សម្រាប់យើង៖ ការបង្ហោះ អ៊ីមែល ការចូល (Google Firebase) ការជូនដំណឹងរុញ និងការបង់ប្រាក់។ ពួកគេអាចប្រើវាសម្រាប់តែការងារនោះប៉ុណ្ណោះ។
- អាជ្ញាធរ នៅពេលដែលច្បាប់តម្រូវ។
យើងមិនដែលលក់ទិន្នន័យផ្ទាល់ខ្លួនរបស់អ្នកទេ។

## រយៈពេលរក្សាទុក
យើងរក្សាគណនីរបស់អ្នកដរាបណាអ្នកនៅតែប្រើវា។ កំណត់ត្រាការបញ្ជាទិញ និងការបង់ប្រាក់ត្រូវបានរក្សាទុកតាមរយៈពេលដែលច្បាប់ពន្ធ និងគណនេយ្យតម្រូវ។ លេខកូដចូលផុតកំណត់ក្រោយ 10 នាទី។

## ជម្រើសរបស់អ្នក
- ប្តូរព័ត៌មាន ពាក្យសម្ងាត់ និងជម្រើសការជូនដំណឹងនៅក្នុងគណនីរបស់អ្នក។
- បើកការចូលពីរជំហានដើម្បីការពារបន្ថែម។
- ស្នើសុំច្បាប់ចម្លងទិន្នន័យរបស់អ្នក ឬលុបគណនី តាមរយៈទំព័រជំនួយ។

## សុវត្ថិភាព
ពាក្យសម្ងាត់ត្រូវបាន hash ការតភ្ជាប់ត្រូវបានអ៊ិនគ្រីប ហើយព័ត៌មានរសើបដូចជារូបថតអត្តសញ្ញាណប័ណ្ណត្រូវបានរក្សាជាឯកជន។ គ្មានប្រព័ន្ធណាមួយមានសុវត្ថិភាពល្អឥតខ្ចោះទេ ដូច្នេះសូមប្រើពាក្យសម្ងាត់រឹងមាំ និងការចូលពីរជំហាន។

## ការផ្លាស់ប្តូរ និងទំនាក់ទំនង
យើងអាចធ្វើបច្ចុប្បន្នភាពគោលការណ៍នេះ ហើយនឹងប្តូរកាលបរិច្ឆេទនៅខាងលើទំព័រនេះនៅពេលនោះ។ សំណួរអំពីទិន្នន័យរបស់អ្នក៖ សូមប្រើទំព័រជំនួយ។
$kh$));

-- Console audit can name site content as what changed.
ALTER TABLE admin_audit DROP CONSTRAINT admin_audit_target_type_check;
ALTER TABLE admin_audit ADD CONSTRAINT admin_audit_target_type_check CHECK (target_type IN ('USER', 'BUSINESS',
    'ORDER', 'REVIEW', 'PROMOTION', 'PAYOUT', 'SETTINGS', 'CATEGORY', 'STAFF_INVITE', 'EXPORT', 'CONTENT'));
