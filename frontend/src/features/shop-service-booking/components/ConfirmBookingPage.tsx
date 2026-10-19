'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { useSession } from '@/lib/auth';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { fallbackErrorKey, isApiError } from '@/lib/api';
import { formatPhone, isValidPhone, normalizePhone } from '@/lib/utils/phone';
import { cn } from '@/lib/utils/cn';

import { Ic } from '@/features/shop-shared/components/Ic';
import { Field } from '@/features/shop-shared/components/sheets';
import { Crumbs, Gate, ItemPh, NotFound, Spin } from '@/features/shop-shared/components/ui';
import { useAuthGate, useFmt, useShopData } from '@/features/shop-shared/hooks';
import { DAY_MS, hm, net, today0 } from '@/features/shop-shared/rules';
import s from '@/features/shop-shared/shop.module.css';
import { toast, useShopStore } from '@/features/shop-shared/store';
import type { ShopBooking } from '@/features/shop-shared/types';

import { bookService, isoOfLocal, putBooking } from '../queries';
import { staffFor } from './ServicePage';

export function ConfirmBookingPage({ id }: { id: string }) {
  const tm = useTranslations('shop.common');
  const t = useTranslations('shop.confirm');
  const tg = useTranslations('shop.gate');
  const tt = useTranslations('shop.toast');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const f = useFmt();
  const router = useRouter();
  const { user } = useSession();
  const ask = useAuthGate((g) => g.ask);
  const { item, shop } = useShopData();
  const b = useShopStore((st) => st.bk);
  const [errs, setErrs] = useState<{ name?: string; phone?: string }>({});
  const [busy, setBusy] = useState(false);

  if (!user) return <Gate title={tg('book')} onLogin={() => ask('continue', () => {})} />;
  const it = item(id);
  const sh = it && shop(it.shop);
  if (!b || b.id !== id || b.slot === null || !it || !sh)
    return <NotFound title={tm('missing.booking')} />;
  const slot = b.slot;
  const date = today0() + b.day * DAY_MS;
  const dur = it.dur ?? 30;
  const staff = staffFor(it, sh);
  const staffName = staff.find((m) => m.id === b.staff)?.name;
  const cancelH = sh.booking?.freeCancelHours ?? 2;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const name = String(d.get('name') ?? '').trim();
    const phone = String(d.get('phone') ?? '');
    const next = {
      ...(name.length < 2 ? { name: t('errName') } : {}),
      ...(!isValidPhone(phone) ? { phone: t('errPhone') } : {}),
    };
    setErrs(next);
    if (next.name || next.phone) return;
    setBusy(true);
    const store = useShopStore.getState();
    let bk: ShopBooking;
    try {
      bk = await bookService({
        service: it.id,
        ...(b.staff ? { staffId: b.staff } : {}),
        date: isoOfLocal(date),
        start: slot,
        name,
        phone: normalizePhone(phone),
        ...(String(d.get('note') ?? '').trim() ? { note: String(d.get('note')).trim() } : {}),
        ...(store.reschedOf ? { replaces: store.reschedOf } : {}),
      });
    } catch (err) {
      setBusy(false);
      if (isApiError(err, 'SLOT_UNAVAILABLE')) {
        // Someone took it (or it is too soon now): pick another time.
        void qc.invalidateQueries({ queryKey: ['availability', it.id] });
        toast(tt('slotTaken'));
        router.push(`/s/${it.id}`);
        return;
      }
      toast(
        isApiError(err, 'BOOKING_UNAVAILABLE')
          ? tt('bookingClosed')
          : isApiError(err, 'CANCEL_WINDOW_PASSED')
            ? tt('tooLateToChange')
            : tc(fallbackErrorKey(err)),
      );
      return;
    }
    putBooking(qc, user.id, bk);
    void qc.invalidateQueries({ queryKey: ['availability', it.id] });
    store.set({ bk: null, reschedOf: null });
    router.push(`/bookings/${bk.number}`);
    toast(
      bk.status === 'REQUESTED'
        ? tt('bookingRequested')
        : tt('bookingConfirmed', { h: sh.booking?.reminderHours ?? 24 }),
    );
  };

  return (
    <>
      <Crumbs items={[{ label: it.name, href: `/s/${it.id}` }, { label: t('crumb') }]} />
      <h1 className={s.pageT}>{t('title')}</h1>
      <div className={s.twoCol}>
        <form className={cn(s.ckSec, s.glassMat)} noValidate onSubmit={submit} style={{ gap: 18 }}>
          <div className={s.g2}>
            <Field id="bn" label={t('name')} error={errs.name}>
              <input id="bn" name="name" defaultValue={user.name} autoComplete="name" />
            </Field>
            <Field id="bp" label={t('phone')} error={errs.phone} hint={t('phoneHint')}>
              <input
                id="bp"
                name="phone"
                defaultValue={user.phone ? formatPhone(user.phone) : ''}
                inputMode="tel"
                autoComplete="tel"
              />
            </Field>
          </div>
          <div className={s.field}>
            <label htmlFor="bnote">{t('note')}</label>
            <textarea id="bnote" name="note" maxLength={200} placeholder={t('notePh')} />
          </div>
          <div className={cn(s.alert, s.aInfo)}>
            <Ic name="undo" size={16} />
            <span>
              {t('freeUntil', {
                when: `${f.fmtD(date)} ${hm(Math.max(0, slot - cancelH * 60))}`,
              })}
            </span>
          </div>
          <button className={cn(s.btn, s.btnPrimary, s.btnLg)} disabled={busy}>
            {busy ? (
              <>
                <Spin />
                {t('busy')}
              </>
            ) : (
              t('submit')
            )}
          </button>
        </form>
        <aside className={cn(s.panel, s.glassMat, s.sticky)}>
          <div className={s.shopMini}>
            <ItemPh it={it} shop={sh} />
            <div>
              <strong style={{ fontWeight: 500 }}>{it.name}</strong>
              <div className={cn(s.small, s.muted)}>{sh.name}</div>
            </div>
          </div>
          <div className={s.sum}>
            <div>
              <span className={s.muted}>{t('date')}</span>
              <span>{f.fmtD(date)}</span>
            </div>
            <div>
              <span className={s.muted}>{t('time')}</span>
              <span className="num">
                {hm(slot)}–{hm(slot + dur)}
              </span>
            </div>
            <div>
              <span className={s.muted}>{t('with')}</span>
              <span>{staffName ?? t('anyone')}</span>
            </div>
            <div>
              <span className={s.muted}>{t('where')}</span>
              <span style={{ textAlign: 'right' }}>{sh.addr}</span>
            </div>
            <div className={s.tot}>
              <span>{t('payAtShop')}</span>
              <span>{f.money(net(it))}</span>
            </div>
          </div>
          <Link className={cn(s.link, s.quiet, s.small)} href={`/s/${it.id}`}>
            {t('changeTime')}
          </Link>
        </aside>
      </div>
    </>
  );
}
