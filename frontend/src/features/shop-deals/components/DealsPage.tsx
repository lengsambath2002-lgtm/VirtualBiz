'use client';

import { useTranslations } from 'next-intl';

import { EmptyView } from '@/components/feedback';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import { ProductCard } from '@/features/shop-shared/components/cards';
import { ShowMore, useShowMore } from '@/features/shop-shared/components/ShowMore';
import { Crumbs, Ph } from '@/features/shop-shared/components/ui';
import { useFmt, useShopData } from '@/features/shop-shared/hooks';
import s from '@/features/shop-shared/shop.module.css';
import { useCopy } from '@/features/shop-shared/useCopy';

import { usePromoLabel } from '@/features/shop-shared/usePromoLabel';

export function DealsPage() {
  const t = useTranslations('shop.deals');
  const th = useTranslations('shop.home');
  const f = useFmt();
  const copy = useCopy();
  const promoLabel = usePromoLabel();
  const { deals, items, promos, shop } = useShopData();
  const onSale = items.filter((i) => i.off);
  const shownSale = useShowMore(onSale, 12);
  const codes = promos.filter((p) => p.code);
  return (
    <>
      <Crumbs items={[{ label: th('crumbHome'), href: '/home' }, { label: t('crumb') }]} />
      <h1 className={s.pageT}>{t('title')}</h1>
      {!deals.length && !onSale.length && !codes.length && (
        <div className={cn(s.panel, s.glassMat)}>
          <EmptyView title={t('emptyTitle')} body={t('emptyBody')} />
        </div>
      )}
      <div className={cn(s.shops, s.shopsDeals)}>
        {deals.map((e) => {
          const sh = shop(e.shop);
          if (!sh) return null;
          return (
            <Link
              key={e.id}
              className={cn(s.panel, s.glassMat, s.panelLink)}
              href={`/shop/${sh.id}`}
              style={{ gridTemplateColumns: '64px 1fr', alignItems: 'start' }}
            >
              <Ph hue={sh.hue} icon={sh.icon} photo={sh.logo} />
              <div style={{ display: 'grid', gap: 4 }}>
                <span className={cn(s.small, s.muted)}>{sh.name}</span>
                <strong style={{ fontSize: 16 }}>{e.title}</strong>
                <span className={cn(s.muted, s.small)}>{e.body}</span>
                <span className={cn(s.pill, s.warn)} style={{ justifySelf: 'start' }}>
                  {t('ends', { date: f.fmtD(e.ends) })}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
      {onSale.length > 0 && (
        <section className={s.sec}>
          <div className={s.secH}>
            <h2>{t('onSale')}</h2>
          </div>
          <div className={s.grid}>
            {shownSale.rows.map((it) => (
              <ProductCard key={it.id} it={it} />
            ))}
          </div>
          <ShowMore {...shownSale.more} />
        </section>
      )}
      {codes.length > 0 && (
        <div className={cn(s.panel, s.glassMat)}>
          <h2>{t('codes')}</h2>
          {promos.map((p) =>
            p.code ? (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  <code className={s.code}>{p.code}</code>{' '}
                  <span className={s.muted}>{promoLabel(p)}</span>
                </span>
                <button className={cn(s.btn, s.btnGhost, s.btnSm)} onClick={() => copy(p.code!)}>
                  {t('copy')}
                </button>
              </div>
            ) : null,
          )}
        </div>
      )}
    </>
  );
}
