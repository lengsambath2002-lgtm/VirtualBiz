'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { Link, useRouter } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import { Ic } from '@/features/shop-shared/components/Ic';
import { OpenLabel, ProductCard, useToggleSave } from '@/features/shop-shared/components/cards';
import { ReviewsBlock, useReviewRows } from '@/features/shop-shared/components/Reviews';
import { NotFound, Ph, Star, StarRow, tintClass } from '@/features/shop-shared/components/ui';
import { useFmt, useNeedAuth, useShopData } from '@/features/shop-shared/hooks';
import {
  DAY_MS,
  SLOT_GROUPS,
  hm,
  hueOf,
  initials,
  kfmt,
  net,
  today0,
} from '@/features/shop-shared/rules';
import s from '@/features/shop-shared/shop.module.css';
import { useIsSaved } from '@/features/shop-shared/saved';
import { toast, useShopStore } from '@/features/shop-shared/store';
import type { BookingDraft, Item, ShopBooking, ShopView } from '@/features/shop-shared/types';
import { Gallery, ItemCrumbs } from '@/features/shop-product/components/ProductPage';
import p from '@/features/shop-product/components/product.module.css';

import { isoOfLocal, useAvailability } from '../queries';
import v from './service.module.css';

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
  const { items } = useShopData();
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
  const price = net(it);
  const when =
    b.slot !== null ? `${f.fmtD(t0 + b.day * DAY_MS)}, ${hm(b.slot)}–${hm(b.slot + dur)}` : null;

  const book = () => needAuth('book', () => router.push(`/s/${it.id}/book`));
  const toPicker = () => document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' });
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: it.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast(tp('linkCopied'));
      }
    } catch {
      /* the share sheet was closed */
    }
  };

  return (
    <div className={p.page}>
      <ItemCrumbs it={it} sh={sh} />
      <div className={p.top}>
        <Gallery it={it} sh={sh} />
        <div className={p.buy}>
          <div className={p.titleRow}>
            <h1>{it.name}</h1>
            <div className={p.meta}>
              <StarRow n={Math.round(it.rating)} />
              <a href="#reviews" className="num">
                {tp('ratingReviews', { rating: it.rating.toFixed(1), count: rows.length })}
              </a>
              <span className={p.metaSep} />
              <span className="num">{t('booked', { n: kfmt(it.sold) })}</span>
              <span className={p.iconBtns}>
                <button
                  type="button"
                  className={p.iconBtn}
                  aria-label={tp('share')}
                  onClick={() => void share()}
                >
                  <Ic name="share" size={18} />
                </button>
                <button
                  type="button"
                  className={p.iconBtn}
                  aria-label={saved ? tp('unsave') : tp('save')}
                  aria-pressed={saved}
                  onClick={() => toggleSave(it.id)}
                >
                  <Ic name="heart" size={18} />
                </button>
              </span>
            </div>
          </div>

          <div className={p.priceCard}>
            <div className={cn(p.priceRow, it.off > 0 && p.sale)}>
              <strong className="num">{f.money(price)}</strong>
              {it.off > 0 && (
                <>
                  <s className="num">{f.money(it.price)}</s>
                  <span className={p.off}>-{it.off}%</span>
                </>
              )}
            </div>
            <span className={cn(p.khr, 'num')}>
              ≈ {f.khr(price)} · {t('payAtShop')}
            </span>
          </div>

          <ul className={v.facts}>
            <li>
              <Ic name="clock" size={18} />
              <span>
                <b className="num">{t('minutes', { n: dur })}</b>
                <small>{t('duration')}</small>
              </span>
            </li>
            <li>
              <Ic name="user" size={18} />
              <span>
                <b className="num">{staff.length || '—'}</b>
                <small>{t('pros', { n: staff.length })}</small>
              </span>
            </li>
            <li>
              <Ic name="undo" size={18} />
              <span>
                <b className="num">{t('hoursBefore', { h: cancelH })}</b>
                <small>{t('freeCancelShort')}</small>
              </span>
            </li>
          </ul>

          {it.desc.trim() && <p className={v.lead}>{it.desc}</p>}

          <button className={cn(s.btn, s.btnPrimary, s.btnLg, v.cta)} onClick={toPicker}>
            <Ic name="clock" size={18} />
            {t('chooseTime')}
          </button>

          <Link className={p.shopCard} href={`/shop/${sh.id}`}>
            <Ph hue={sh.hue} icon={sh.icon} photo={sh.logo} />
            <div>
              <strong>{sh.name}</strong>
              <span>
                <Star n={sh.rating} /> {sh.rating.toFixed(1)} · <OpenLabel shop={sh} />
              </span>
              <span className={v.addr}>
                <Ic name="pin" size={13} /> {sh.addr}, {f.district(sh.area)}
              </span>
            </div>
            <span className={cn(s.btn, s.btnGhost, s.btnSm)}>{tp('visitShop')}</span>
          </Link>
        </div>
      </div>

      <nav className={p.secNav} aria-label={tp('sections')}>
        <a href="#book">{t('chooseTime')}</a>
        <a href="#reviews">{tp('reviewsN', { n: rows.length })}</a>
        {more.length > 0 && <a href="#more">{tp('moreFromShort')}</a>}
      </nav>

      <section id="book" className={v.book} aria-label={t('chooseTime')}>
        <div className={v.picker}>
          <header className={v.pickerH}>
            <h2>{t('chooseTime')}</h2>
            <p>{t('chooseTimeSub')}</p>
          </header>

          {staff.length > 0 && (
            <div className={v.step}>
              <div className={v.stepH}>
                <span className={v.num}>1</span>
                <h3>{t('professional')}</h3>
              </div>
              <div className={v.staff} role="radiogroup" aria-label={t('professional')}>
                {[{ id: '', name: '' }, ...staff].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={b.staff === m.id}
                    className={v.person}
                    onClick={() => setB({ staff: m.id, slot: null })}
                  >
                    <span className={cn(v.av, tintClass(m.id ? hueOf(m.name) : 6))}>
                      {m.id ? initials(m.name) : <Ic name="user" size={16} />}
                    </span>
                    {m.id ? m.name : t('anyone')}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={v.step}>
            <div className={v.stepH}>
              <span className={v.num}>{staff.length > 0 ? 2 : 1}</span>
              <h3>{t('date')}</h3>
              <span className={v.stepNote}>{f.fmtD(t0 + b.day * DAY_MS)}</span>
            </div>
            <div className={v.days} role="radiogroup" aria-label={t('date')}>
              {Array.from({ length: 7 }, (_, k) => {
                const d = t0 + k * DAY_MS;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={k === b.day}
                    className={v.day}
                    onClick={() => setB({ day: k, slot: null })}
                  >
                    <small>{k === 0 ? t('today') : f.weekday(d)}</small>
                    <b className="num">{new Date(d).getDate()}</b>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={v.step}>
            <div className={v.stepH}>
              <span className={v.num}>{staff.length > 0 ? 3 : 2}</span>
              <h3>{t('time')}</h3>
              {!loading && !slotsError && <span className={v.stepNote}>{t('openN', { n: free })}</span>}
            </div>
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
              <div className={v.times} aria-busy="true" aria-label={t('slotsLoading')}>
                {Array.from({ length: 8 }, (_, i) => (
                  <span key={i} className={cn(v.time, s.skel)} />
                ))}
              </div>
            ) : free ? (
              SLOT_GROUPS.map(([g, a, z]) => {
                const xs = slots.filter((x) => x.m >= a && x.m < z);
                return xs.length ? (
                  <div key={g} className={v.slotG}>
                    <h4>
                      <Ic name={g === 'evening' ? 'moon' : 'sun'} size={14} />
                      {t(`groups.${g}`)}
                    </h4>
                    <div className={v.times}>
                      {xs.map((x) => (
                        <button
                          key={x.m}
                          type="button"
                          className={v.time}
                          aria-pressed={b.slot === x.m}
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
                  {b.day < 6 && (
                    <button
                      className={s.link}
                      style={{ color: 'inherit' }}
                      onClick={() => setB({ day: b.day + 1, slot: null })}
                    >
                      {t('tryDay', { date: f.fmtD(t0 + (b.day + 1) * DAY_MS) })}
                    </button>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        <aside className={v.summary} aria-label={t('yourBooking')}>
          <h2>{t('yourBooking')}</h2>
          <dl className={v.sum}>
            <dt>{t('sumService')}</dt>
            <dd>
              {it.name}
              <small className="num">{t('minutes', { n: dur })}</small>
            </dd>
            <dt>{t('sumWith')}</dt>
            <dd>{staffName ?? t('anyoneAvailable')}</dd>
            <dt>{t('sumWhen')}</dt>
            <dd className="num">{when ?? <span className={v.pending}>{t('pickTime')}</span>}</dd>
          </dl>
          <div className={v.total}>
            <span>{t('total')}</span>
            <span>
              <strong className="num">{f.money(price)}</strong>
              <small className="num">≈ {f.khr(price)}</small>
            </span>
          </div>
          <button
            className={cn(s.btn, s.btnPrimary, s.btnLg, s.btnBlock)}
            disabled={b.slot === null}
            onClick={book}
          >
            {b.slot === null ? t('pickToContinue') : t('continue')}
          </button>
          <p className={v.note}>
            <Ic name="undo" size={16} />
            {t('freeCancel', { h: cancelH })}
          </p>
          <p className={v.note}>
            <Ic name="shield" size={16} />
            {t('payAtShop')}
          </p>
        </aside>
      </section>

      <ReviewsBlock itemId={it.id} shopName={sh.name} />
      {more.length > 0 && (
        <section id="more" className={cn(s.sec, p.anchor)}>
          <div className={s.secH}>
            <h2>{t('moreAt', { shop: sh.name })}</h2>
            <Link className={s.link} href={`/shop/${sh.id}`}>
              {tp('viewShop')}
            </Link>
          </div>
          <div className={s.grid}>
            {more.map((x) => (
              <ProductCard key={x.id} it={x} />
            ))}
          </div>
        </section>
      )}

      {/* Phones: the chosen time and Continue stay at hand. */}
      <div className={cn(p.buyBar, v.bar)} data-pdp-bar>
        <div>
          <strong className="num">{f.money(price)}</strong>
          <span className="num">{when ?? t('minutes', { n: dur })}</span>
        </div>
        {b.slot === null ? (
          <button className={cn(s.btn, s.btnPrimary)} onClick={toPicker}>
            {t('chooseTime')}
          </button>
        ) : (
          <button className={cn(s.btn, s.btnPrimary)} onClick={book}>
            {t('continue')}
          </button>
        )}
      </div>
    </div>
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
