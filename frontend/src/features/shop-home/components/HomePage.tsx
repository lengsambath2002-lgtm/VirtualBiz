'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { useSession } from '@/lib/auth';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import { useMyOrders } from '@/features/shop-order-tracking/queries';
import { ProductCard, ShopCard } from '@/features/shop-shared/components/cards';
import { Ph } from '@/features/shop-shared/components/ui';
import { useFmt, useShopData } from '@/features/shop-shared/hooks';
import { dist } from '@/features/shop-shared/rules';
import s from '@/features/shop-shared/shop.module.css';
import { useShopStore } from '@/features/shop-shared/store';
import { useMyBookings } from '@/features/shop-service-booking/queries';
import type { Item } from '@/features/shop-shared/types';
import { searchHref } from '@/features/shop-search/util/searchParams';

/** Flash-deal countdown to midnight, ticking every second. */
function Countdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const end = new Date(now);
  end.setHours(23, 59, 59, 0);
  const sec = Math.max(0, Math.floor((end.getTime() - now) / 1000));
  const parts = [Math.floor(sec / 3600), Math.floor(sec / 60) % 60, sec % 60];
  return (
    <span className={cn(s.cd, 'num')}>
      {parts.map((x, i) => (
        <span key={i} style={{ display: 'contents' }}>
          {i > 0 && ':'}
          <b>{String(x).padStart(2, '0')}</b>
        </span>
      ))}
    </span>
  );
}

const claimed = (it: Item) => Math.min(95, Math.round((it.sold / (it.sold + it.stock * 20)) * 100));

export function HomePage() {
  const t = useTranslations('shop.home');
  const f = useFmt();
  const { items, shops, categories, item, districts } = useShopData();
  const { signedIn } = useSession();
  const area = useShopStore((st) => st.area);
  const here = useShopStore((st) => st.here);
  const { data: orders = [] } = useMyOrders();
  const { bookings } = useMyBookings();

  const deals = items.filter((i) => i.off && i.type === 'product').slice(0, 5);
  const svc = items
    .filter((i) => i.type === 'service')
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5);
  const near = [...shops]
    .sort((a, b) => dist(a, area, districts, here) - dist(b, area, districts, here))
    .slice(0, 4);
  const again = signedIn
    ? [
        ...new Set([
          ...orders.flatMap((o) => o.lines.map((l) => l.pid)),
          ...bookings.map((b) => b.serviceId),
        ]),
      ]
        .map(item)
        .filter((x): x is Item => !!x)
    : [];
  const recs = items
    .filter((i) => i.type === 'product' && !i.off)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5);

  return (
    <>
      <section className={s.hero}>
        <div className={s.banner}>
          <span className={s.eyebrow}>{t('eyebrow')}</span>
          <h1>{t('title')}</h1>
          <p>{t.rich('body', { code: (c) => <b style={{ color: '#F5B800' }}>{c}</b> })}</p>
          <Link className={cn(s.btn, s.btnAccent)} href="/deals">
            {t('cta')}
          </Link>
        </div>
        <div className={s.sideB}>
          <Link className={cn(s.miniB, s.t3)} href={searchHref({ type: 'service' })}>
            <span className={s.miniEyebrow}>{t('bookEyebrow')}</span>
            <strong>{t('bookTitle')}</strong>
            <span className={s.small}>{t('bookNote')}</span>
          </Link>
          <Link className={cn(s.miniB, s.t6)} href="/help">
            <span className={s.miniEyebrow}>{t('bizEyebrow')}</span>
            <strong>{t('bizTitle')}</strong>
            <span className={s.small}>{t('bizNote')}</span>
          </Link>
        </div>
      </section>

      <section className={s.sec}>
        <div className={s.catrow}>
          {categories.map((c) => (
            <Link
              key={c.id}
              className={s.cat}
              href={searchHref({ type: c.type, category: [c.id] })}
            >
              <Ph hue={c.tint} icon={c.icon} />
              <span>{f.category(c.id)}</span>
            </Link>
          ))}
        </div>
      </section>

      {deals.length > 0 && (
        <section className={cn(s.flash, s.glassMat)}>
          <div className={s.flashH}>
            <h2>{t('flash')}</h2>
            <span className={cn(s.small, s.muted)}>{t('endsIn')}</span>
            <Countdown />
            <Link
              className={s.link}
              href={searchHref({ type: 'product', sale: true })}
              style={{ marginLeft: 'auto' }}
            >
              {t('seeAll')}
            </Link>
          </div>
          <div className={s.grid}>
            {deals.map((it) => (
              <ProductCard
                key={it.id}
                it={it}
                extra={
                  <div className={s.bar} title={t('claimed', { pct: claimed(it) })}>
                    <i style={{ width: `${claimed(it)}%` }} />
                  </div>
                }
              />
            ))}
          </div>
        </section>
      )}

      {again.length > 0 && (
        <section className={s.sec}>
          <div className={s.secH}>
            <h2>{t('again')}</h2>
            <Link className={s.link} href="/account/orders">
              {t('yourOrders')}
            </Link>
          </div>
          <div className={s.grid}>
            {again.map((it) => (
              <ProductCard key={it.id} it={it} />
            ))}
          </div>
        </section>
      )}

      {svc.length > 0 && (
        <section className={s.sec}>
          <div className={s.secH}>
            <h2>{t('popularServices')}</h2>
            <Link className={s.link} href={searchHref({ type: 'service' })}>
              {t('seeAll')}
            </Link>
          </div>
          <div className={s.grid}>
            {svc.map((it) => (
              <ProductCard key={it.id} it={it} />
            ))}
          </div>
        </section>
      )}

      {near.length > 0 && (
        <section className={s.sec}>
          <div className={s.secH}>
            <h2>{t('shopsNear', { area: f.district(area) })}</h2>
            <Link className={s.link} href={searchHref({ type: 'shop' })}>
              {t('allShops')}
            </Link>
          </div>
          <div className={s.shops}>
            {near.map((sh) => (
              <ShopCard key={sh.id} sh={sh} />
            ))}
          </div>
        </section>
      )}

      {recs.length > 0 && (
        <section className={s.sec}>
          <div className={s.secH}>
            <h2>{t('topRated')}</h2>
          </div>
          <div className={s.grid}>
            {recs.map((it) => (
              <ProductCard key={it.id} it={it} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
