'use client';

import { useTranslations } from 'next-intl';
import type { MouseEvent, ReactNode } from 'react';

import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import { useFmt, useNeedAuth, useShopData } from '../hooks';
import { dist, isOpen, kfmt, net } from '../rules';
import s from '../shop.module.css';
import { useIsSaved, useToggleSavedKey } from '../saved';
import { toast, useShopStore } from '../store';
import type { Item, ShopView } from '../types';
import { Ic } from './Ic';
import { ItemPh, Ph, Star } from './ui';

export const itemHref = (it: Pick<Item, 'id' | 'type'>) =>
  it.type === 'service' ? `/s/${it.id}` : `/p/${it.id}`;

/** Save / unsave an item (login required), with the prototype's toasts. */
export function useToggleSave() {
  const t = useTranslations('shop.toast');
  const needAuth = useNeedAuth();
  const toggle = useToggleSavedKey();
  return (id: string) =>
    needAuth('saveItems', () => {
      const now = toggle(id);
      if (now) toast(t('saved'), { label: t('viewSaved'), href: '/account/saved' });
      else toast(t('unsaved'));
    });
}

export function ProductCard({ it, extra }: { it: Item; extra?: ReactNode }) {
  const t = useTranslations('shop.card');
  const f = useFmt();
  const { shop, districts } = useShopData();
  const area = useShopStore((st) => st.area);
  const here = useShopStore((st) => st.here);
  const on = useIsSaved(it.id);
  const toggleSave = useToggleSave();
  const sh = shop(it.shop);
  const out = it.type === 'product' && it.stock === 0;
  const onHeart = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSave(it.id);
  };
  return (
    <Link className={cn(s.pc, s.glassMat)} href={itemHref(it)}>
      <ItemPh it={it} shop={sh} />
      {out && <div className={s.soldOut}>{t('soldOut')}</div>}
      {it.off > 0 && <span className={s.tag}>-{it.off}%</span>}
      <button
        className={cn(s.heart, on && s.on)}
        onClick={onHeart}
        aria-label={on ? t('unsave') : t('save')}
        aria-pressed={on}
      >
        <Ic name="heart" size={18} />
      </button>
      <div className={s.pcB}>
        <div className={s.pcN}>{it.name}</div>
        <div className={cn(s.price, it.off > 0 && s.sale)}>
          <strong>{f.money(net(it))}</strong>
          {it.off > 0 && <s>{f.money(it.price)}</s>}
        </div>
        <div className={s.pcM}>
          <Star n={it.rating} />
          <span className="num">{it.rating.toFixed(1)}</span>
          <span>·</span>
          <span>
            {it.type === 'service'
              ? t('minutes', { n: it.dur ?? 0 })
              : t('sold', { n: kfmt(it.sold) })}
          </span>
        </div>
        {sh && (
          <div className={s.pcM}>
            {t('shopKm', { shop: sh.name, km: dist(sh, area, districts, here) })}
          </div>
        )}
        {extra}
      </div>
    </Link>
  );
}

export function OpenLabel({ shop }: { shop: ShopView }) {
  const t = useTranslations('shop.card');
  const open = isOpen(shop);
  return <span className={open ? s.open : s.closed}>{open ? t('open') : t('closed')}</span>;
}

export function ShopCard({ sh }: { sh: ShopView }) {
  const t = useTranslations('shop.card');
  const f = useFmt();
  const { districts } = useShopData();
  const area = useShopStore((st) => st.area);
  const here = useShopStore((st) => st.here);
  return (
    <Link className={cn(s.sc, s.glassMat)} href={`/shop/${sh.id}`}>
      <Ph hue={sh.hue} icon={sh.icon} photo={sh.logo} />
      <span style={{ minWidth: 0 }}>
        <strong>{sh.name}</strong>
        <span className={s.pcM}>
          <Star n={sh.rating} />
          <span className="num">{sh.rating.toFixed(1)}</span> · {f.category(sh.catId)}
        </span>
        <span className={s.pcM}>
          <OpenLabel shop={sh} /> · {t('km', { km: dist(sh, area, districts, here) })}
          {sh.eta ? ` · ${t('etaMin', { a: sh.eta[0], b: sh.eta[1] })}` : ''}
        </span>
      </span>
    </Link>
  );
}
