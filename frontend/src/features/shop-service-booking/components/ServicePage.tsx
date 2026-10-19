'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { Link, useRouter } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import { Ic } from '@/features/shop-shared/components/Ic';
import { ProductCard, useToggleSave } from '@/features/shop-shared/components/cards';
import { ReviewsBlock, useReviewRows } from '@/features/shop-shared/components/Reviews';
import { NotFound, Ph, Star, StarRow, tintClass } from '@/features/shop-shared/components/ui';
import { useFmt, useNeedAuth, useShopData } from '@/features/shop-shared/hooks';
import {
  DAY_MS,
  SLOT_GROUPS,
  dist,
  hm,
  hueOf,
  initials,
  kfmt,
  net,
  today0,
} from '@/features/shop-shared/rules';
import s from '@/features/shop-shared/shop.module.css';
import { useIsSaved } from '@/features/shop-shared/saved';
import { useShopStore } from '@/features/shop-shared/store';
import type { BookingDraft, Item, ShopBooking, ShopView } from '@/features/shop-shared/types';
import { Gallery, ItemCrumbs } from '@/features/shop-product/components/ProductPage';

import { isoOfLocal, useAvailability } from '../queries';

/** Bookings that still hold their slot. */
export const isUpcoming = (b: ShopBooking) =>
  b.status === 'REQUESTED' || b.status === 'BOOKED' || b.status === 'CONFIRMED';

/** Staff who can perform the service (all shop staff when the service lists none). */
export const staffFor = (it: Item, sh: ShopView) =>
  it.staffIds?.length ? sh.staff.filter((m) => it.staffIds!.includes(m.id)) : sh.staff;

/**
 * The draft day's start times from the API's availability: a time is open when the chosen
 * professional (or anyone, when none is chosen) is free then.
 */
export function useSlots(it: Item, b: BookingDraft) {
  const from = isoOfLocal(today0());
  const q = useAvailability(it.id, from, b.staff);
  const day = q.data?.days[b.day];
  const slots = (day?.slots ?? []).map((x) => ({
    m: x.start,
    dis: b.staff ? !x.staffIds.includes(b.staff) : x.staffIds.length === 0,
  }));
  return {
    slots,
    loading: q.isLoading,
    error: q.data ? null : q.error,
    retry: () => void q.refetch(),
  };
}

function ServiceView({ it, sh }: { it: Item; sh: ShopView }) {
  const t = useTranslations('shop.service');
  const tp = useTranslations('shop.product');
  const f = useFmt();
  const router = useRouter();
  const { items, districts } = useShopData();
  const area = useShopStore((st) => st.area);
  const here = useShopStore((st) => st.here);
  const saved = useIsSaved(it.id);
  const draft = useShopStore((st) => st.bk);
  const needAuth = useNeedAuth();
  const toggleSave = useToggleSave();
  const rows = useReviewRows(it.shop)(it.id);

  useEffect(() => {
    if (!draft || draft.id !== it.id)
      useShopStore.getState().set({ bk: { id: it.id, staff: '', day: 0, slot: null } });
  }, [draft, it.id]);
  const b: BookingDraft =
    draft && draft.id === it.id ? draft : { id: it.id, staff: '', day: 0, slot: null };
  const setB = (patch: Partial<BookingDraft>) =>
    useShopStore.getState().set({ bk: { ...b, ...patch } });

  const { slots, loading, error: slotsError, retry: retrySlots } = useSlots(it, b);
  const free = slots.filter((x) => !x.dis).length;
  const more = items.filter((i) => i.shop === sh.id && i.id !== it.id);
  const staff = staffFor(it, sh);
  const staffName = staff.find((m) => m.id === b.staff)?.name;
  const t0 = today0();
  const dur = it.dur ?? 30;
  const cancelH = sh.booking?.freeCancelHours ?? 2;

  return (
    <>
      <ItemCrumbs it={it} sh={sh} />
      <div className={cn(s.pdp, s.svc, s.glassMat)}>
        <Gallery it={it} sh={sh} />
        <div className={s.info}>
          <h1>{it.name}</h1>
          <div className={s.metaRow}>
            <StarRow n={Math.round(it.rating)} />
            <a href="#reviews" className="num">
              {tp('ratingReviews', { rating: it.rating.toFixed(1), count: rows.length })}
            </a>
            <span className={s.sep} />
            <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <Ic name="clock" size={14} /> {t('minutes', { n: dur })}
            </span>
            <span className={s.sep} />
            <span className="num">{t('booked', { n: kfmt(it.sold) })}</span>
          </div>
          <div className={s.pbox}>
            <div className={cn(s.price, it.off > 0 && s.sale)}>
              <strong>{f.money(net(it))}</strong>
              {it.off > 0 && (
                <>
                  <s>{f.money(it.price)}</s>
                  <span className={cn(s.pill, s.bad)}>-{it.off}%</span>
                </>
              )}
            </div>
            <span className={cn(s.small, s.muted)}>{t('payAtShop')}</span>
          </div>
          <p className={s.desc}>{it.desc}</p>
          <div className={cn(s.panel, s.glassMat)} style={{ gap: 16 }}>
            <h2>{t('chooseTime')}</h2>
            {staff.length > 0 && (
              <div className={s.optG}>
                <span className={s.lbl}>{t('professional')}</span>
                <div className={s.staff}>
                  {[{ id: '', name: '' }, ...staff].map((p) => (
                    <button
                      key={p.id}
                      className={cn(b.staff === p.id && s.on)}
                      aria-pressed={b.staff === p.id}
                      onClick={() => setB({ staff: p.id, slot: null })}
                    >
                      <span className={cn(s.avS, tintClass(p.id ? hueOf(p.name) : 6))}>
                        {p.id ? initials(p.name) : <Ic name="user" size={16} />}
                      </span>
                      {p.id ? p.name : t('anyone')}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className={s.optG}>
              <span className={s.lbl}>{t('date')}</span>
              <div className={s.days}>
                {Array.from({ length: 7 }, (_, k) => {
                  const d = t0 + k * DAY_MS;
                  return (
                    <button
                      key={k}
                      className={cn(s.day, k === b.day && s.on)}
                      aria-pressed={k === b.day}
                      onClick={() => setB({ day: k, slot: null })}
                    >
                      {k === 0 ? t('today') : f.weekday(d)}
                      <b className="num">{new Date(d).getDate()}</b>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={s.optG}>
              <span className={s.lbl}>
                {t('time')} <span>{t('open', { n: free })}</span>
              </span>
              {slotsError ? (
                // Times that failed to load are not "fully booked": say so, offer a retry.
                <div className={cn(s.alert, s.aInfo)} role="alert">
                  <span>
                    {t('slotsFailed')}{' '}
                    <button className={s.link} style={{ color: 'inherit' }} onClick={retrySlots}>
                      {t('slotsRetry')}
                    </button>
                  </span>
                </div>
              ) : loading ? (
                <div className={s.slots} aria-busy="true" aria-label={t('slotsLoading')}>
                  {Array.from({ length: 8 }, (_, i) => (
                    <span key={i} className={cn(s.slot, s.skel)} style={{ minHeight: 40 }} />
                  ))}
                </div>
              ) : free ? (
                SLOT_GROUPS.map(([g, a, z]) => {
                  const xs = slots.filter((x) => x.m >= a && x.m < z);
                  return xs.length ? (
                    <div key={g} className={s.slotG}>
                      <h4>{t(`groups.${g}`)}</h4>
                      <div className={s.slots}>
                        {xs.map((x) => (
                          <button
                            key={x.m}
                            className={cn(s.slot, b.slot === x.m && s.on)}
                            disabled={x.dis}
                            aria-label={x.dis ? t('unavailable', { time: hm(x.m) }) : undefined}
                            onClick={() => setB({ slot: x.m })}
                          >
                            {hm(x.m)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })
              ) : (
                <div className={cn(s.alert, s.aInfo)}>
                  <span>
                    {t('fullyBooked')}{' '}
                    <button
                      className={s.link}
                      style={{ color: 'inherit' }}
                      onClick={() => setB({ day: Math.min(6, b.day + 1), slot: null })}
                    >
                      {t('tryDay', { date: f.fmtD(t0 + (b.day + 1) * DAY_MS) })}
                    </button>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <aside className={s.buySide}>
          <div className={cn(s.panel, s.glassMat)}>
            <div className={s.shopMini}>
              <Ph hue={sh.hue} icon={sh.icon} photo={sh.logo} />
              <div>
                <Link href={`/shop/${sh.id}`} style={{ fontWeight: 500, textDecoration: 'none' }}>
                  {sh.name}
                </Link>
                <div className={s.pcM}>
                  <Star n={sh.rating} /> {sh.rating.toFixed(1)} ·{' '}
                  {t('km', { km: dist(sh, area, districts, here) })}
                </div>
              </div>
            </div>
            <div className={s.sum}>
              <div>
                <span className={s.muted}>{t('sumService')}</span>
                <span style={{ textAlign: 'right' }}>{it.name}</span>
              </div>
              <div>
                <span className={s.muted}>{t('sumWith')}</span>
                <span>{staffName ?? t('anyoneAvailable')}</span>
              </div>
              <div>
                <span className={s.muted}>{t('sumWhen')}</span>
                <span className="num">
                  {b.slot !== null ? (
                    `${f.fmtD(t0 + b.day * DAY_MS)}, ${hm(b.slot)}–${hm(b.slot + dur)}`
                  ) : (
                    <span className={s.muted}>{t('pickTime')}</span>
                  )}
                </span>
              </div>
              <div className={s.tot}>
                <span>{t('total')}</span>
                <span>{f.money(net(it))}</span>
              </div>
            </div>
            <button
              className={cn(s.btn, s.btnPrimary, s.btnLg, s.btnBlock)}
              disabled={b.slot === null}
              onClick={() => needAuth('book', () => router.push(`/s/${it.id}/book`))}
            >
              {t('continue')}
            </button>
            <div className={s.perk}>
              <Ic name="undo" size={18} />
              <span className={s.small}>{t('freeCancel', { h: cancelH })}</span>
            </div>
            <div className={s.perk}>
              <Ic name="pin" size={18} />
              <span className={s.small}>
                {sh.addr}, {f.district(sh.area)}
              </span>
            </div>
          </div>
          <button
            className={cn(s.btn, s.btnGhost)}
            aria-pressed={saved}
            style={{ color: saved ? 'var(--sale)' : 'inherit' }}
            onClick={() => toggleSave(it.id)}
          >
            <Ic name="heart" size={18} />
            {saved ? t('saved') : t('saveForLater')}
          </button>
        </aside>
      </div>
      <ReviewsBlock itemId={it.id} shopName={sh.name} />
      {more.length > 0 && (
        <section className={s.sec}>
          <div className={s.secH}>
            <h2>{t('moreAt', { shop: sh.name })}</h2>
          </div>
          <div className={s.grid}>
            {more.map((x) => (
              <ProductCard key={x.id} it={x} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export function ServicePage({ id }: { id: string }) {
  const tm = useTranslations('shop.common');
  const { item, shop } = useShopData();
  const it = item(id);
  const sh = it && shop(it.shop);
  if (!it || it.type !== 'service' || !sh) return <NotFound title={tm('missing.service')} />;
  return <ServiceView key={id} it={it} sh={sh} />;
}
