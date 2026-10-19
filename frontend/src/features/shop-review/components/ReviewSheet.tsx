'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';

import { api, fallbackErrorKey, isApiError, type ApiMyReview, type ReviewInput } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { cn } from '@/lib/utils/cn';

import { orderKey, ordersKey, useMyOrders } from '@/features/shop-order-tracking/queries';
import { useMyBookings } from '@/features/shop-service-booking/queries';
import { Ic } from '@/features/shop-shared/components/Ic';
import {
  QUICK_TAGS,
  setReviewOpener,
  type QuickTag,
} from '@/features/shop-shared/components/sheets';
import { Modal, Spin } from '@/features/shop-shared/components/ui';
import { useShopData } from '@/features/shop-shared/hooks';
import { myReviewsKey, useMyReviews } from '@/features/shop-shared/reviews';
import s from '@/features/shop-shared/shop.module.css';
import { toast } from '@/features/shop-shared/store';

/**
 * "Rate …": a review of a product from a delivered order, or of a service from a completed
 * booking (`POST /api/me/reviews`). Opened from an order without saying which, it uses the
 * customer's most recent eligible order or booking for that item that is not reviewed yet.
 */
export function ReviewSheet() {
  const t = useTranslations('shop.review');
  const tt = useTranslations('shop.toast');
  const tc = useTranslations('common');
  const { item } = useShopData();
  const { user } = useSession();
  const qc = useQueryClient();
  const { data: orders = [] } = useMyOrders();
  const { bookings } = useMyBookings();
  const { data: mine = [] } = useMyReviews();
  const [st, setSt] = useState<{ id: string; order?: string; booking?: string } | null>(null);
  const [n, setN] = useState(0);
  const [tags, setTags] = useState<QuickTag[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setReviewOpener((id, order) => {
      const done = (r: ApiMyReview) => r.itemSlug === id;
      const target = order
        ? { order }
        : (() => {
            const o = orders.find(
              (x) =>
                (x.status === 'DELIVERED' || x.status === 'PICKED_UP') &&
                x.lines.some((l) => l.pid === id) &&
                !mine.some((r) => done(r) && r.orderNumber === x.number),
            );
            if (o) return { order: o.number };
            const b = bookings.find(
              (x) =>
                x.status === 'COMPLETED' &&
                x.serviceId === id &&
                !mine.some((r) => done(r) && r.bookingNumber === x.number),
            );
            return b ? { booking: b.number } : null;
          })();
      if (!target) {
        toast(tt('reviewNeedsPurchase'));
        return;
      }
      setN(0);
      setTags([]);
      setText('');
      setSt({ id, ...target });
    });
    return () => setReviewOpener(null);
  }, [orders, bookings, mine, tt]);

  const it = st ? item(st.id) : undefined;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!n || !st) return;
    setBusy(true);
    const body: ReviewInput = {
      item: st.id,
      stars: n,
      tags,
      text: text.trim(),
      ...(st.order ? { order: st.order } : {}),
      ...(st.booking ? { booking: st.booking } : {}),
    };
    try {
      await api.post<ApiMyReview>('/me/reviews', body);
      setSt(null);
      toast(tt('reviewLive'));
    } catch (err) {
      toast(isApiError(err, 'CONFLICT') ? tt('alreadyReviewed') : tc(fallbackErrorKey(err)));
    } finally {
      setBusy(false);
      void qc.invalidateQueries({ queryKey: myReviewsKey(user?.id) });
      void qc.invalidateQueries({ queryKey: ['shop', 'reviews'] });
      if (st.order) {
        void qc.invalidateQueries({ queryKey: orderKey(user?.id, st.order) });
        void qc.invalidateQueries({ queryKey: ordersKey(user?.id), exact: true });
      }
    }
  };

  return (
    <Modal open={!!st} onClose={() => setSt(null)} title={it ? t('title', { name: it.name }) : ''}>
      <form className={s.modalForm} noValidate onSubmit={submit}>
        <div className={s.field}>
          <span className={s.lbl}>{t('yourRating')}</span>
          <div className={s.rateStars} role="radiogroup" aria-label={t('rating')}>
            {[1, 2, 3, 4, 5].map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={k === n}
                aria-label={t('stars', { n: k })}
                className={cn(k <= n && s.on)}
                onClick={() => setN(k)}
              >
                <Ic name="star" size={32} />
              </button>
            ))}
          </div>
          <span className={cn(s.small, s.muted)}>
            {n ? t(`level.${n}` as 'level.1') : t('tap')}
          </span>
        </div>
        <div className={cn(s.chips, s.chipsWrap)}>
          {QUICK_TAGS.map((k) => {
            const on = tags.includes(k);
            return (
              <button
                key={k}
                type="button"
                className={cn(s.chip, s.chipSm, on && s.on)}
                aria-pressed={on}
                onClick={() => setTags((x) => (on ? x.filter((y) => y !== k) : [...x, k]))}
              >
                {t(`tags.${k}`)}
              </button>
            );
          })}
        </div>
        <div className={s.field}>
          <label htmlFor="rt">{t('more')}</label>
          <textarea
            id="rt"
            maxLength={500}
            placeholder={t('morePh')}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <button className={cn(s.btn, s.btnPrimary, s.btnBlock)} disabled={!n || busy}>
          {busy ? <Spin /> : null}
          {t('post')}
        </button>
      </form>
    </Modal>
  );
}
