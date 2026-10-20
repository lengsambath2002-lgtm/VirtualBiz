'use client';

import { useTranslations } from 'next-intl';
import { createElement as h, useState } from 'react';

import { ShopPhotos } from '@/components/media';
import { useMyRole } from '@/features/account-switcher';
import { PayoutsPanel, VerificationPanel } from '@/features/business-status';
import { formatPhone, isValidPhone, normalizePhone } from '@/lib/utils/phone';

import { PIcon } from '@/features/provider-shared/components/Icon';
import { Field } from '@/features/provider-shared/components/Overlay';
import { k } from '@/features/provider-shared/cx';
import { useFmt } from '@/features/provider-shared/hooks/useFmt';
import { useSaveBusiness } from '@/features/provider-shared/hooks/useSaveBusiness';
import { useData, useUi } from '@/features/provider-shared/store';
import type { ProviderBusinessState } from '@/features/provider-shared/types';
import {
  addDays,
  fmtD,
  hm,
  isIsoDate,
  todayIso,
  toMin,
} from '@/features/provider-shared/util/time';

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
type Toggle = 'online' | 'autoConfirm' | 'reminder';
type Sel = 'minNoticeHours' | 'freeCancelHours' | 'bufferMinutes';

/** Settings: business, hours & closures, booking rules (prototype `P.settings`). */
export function SettingsPage() {
  const { t } = useFmt();
  const ui = useUi();
  const tab = ui.setTab;
  // What this member's role may change (docs/api/phase10-shop-team.md); the API enforces it.
  const role = useMyRole(useData().business.id);
  const tt = useTranslations('team');
  return (
    <>
      <div className={k('ph-h')}>
        <h1>{t('settings.title')}</h1>
      </div>
      <div className={k('seg')}>
        {(
          [
            ['business', 'tabBusiness'],
            ['hours', 'tabHours'],
            ['rules', 'tabRules'],
          ] as const
        ).map(([key, l]) => (
          <button
            key={key}
            type="button"
            className={k(tab === key && 'on')}
            onClick={() => ui.set({ setTab: key })}
          >
            {t(`settings.${l}`)}
          </button>
        ))}
      </div>
      {role === 'STAFF' && <p className={k('small muted')}>{tt('readOnlySettings')}</p>}
      <fieldset
        disabled={role === 'STAFF'}
        style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: 'contents' }}
      >
        <div style={{ display: 'grid', gap: 16, maxWidth: 760 }}>
          {tab === 'business' ? (
            <>
              <BusinessPhotos />
              <BusinessForm />
              <BusinessPayments />
            </>
          ) : tab === 'hours' ? (
            <Hours />
          ) : (
            <Rules />
          )}
        </div>
      </fieldset>
    </>
  );
}

/** Logo and cover: shown on the shop page and in search. */
function BusinessPhotos() {
  const tc = useTranslations('common.image');
  const b = useData().business;
  const ui = useUi();
  const save = useSaveBusiness();
  return (
    <section className={k('panel')}>
      <div className={k('panel-h')}>
        <h2>{tc('shopPhotos')}</h2>
      </div>
      <div className={k('panel-b')}>
        <ShopPhotos
          name={b.name}
          logoUrl={b.logoUrl}
          coverUrl={b.coverUrl}
          onSave={save}
          onToast={ui.showToast}
          btn={k('btn btn-primary btn-sm')}
          btnGhost={k('btn btn-ghost btn-sm')}
        />
        <span className={k('hint')}>{tc('shopHint')}</span>
      </div>
    </section>
  );
}

/** Bakong ID (where payouts go; optional at creation), the ID check and payouts. */
function BusinessPayments() {
  const { t } = useFmt();
  const b = useData().business;
  const owner = useMyRole(b.id);
  const tt = useTranslations('team');
  const ui = useUi();
  const save = useSaveBusiness();
  const [bakong, setBakong] = useState(b.bakongId ?? '');
  const [err, setErr] = useState('');
  const commit = () => {
    const v = bakong.trim();
    if (v === (b.bakongId ?? '')) return;
    if (v && !/^[a-z0-9._-]{2,40}@[a-z]{2,20}$/i.test(v)) return setErr(t('settings.errBakong'));
    setErr('');
    void save({ bakongId: v || null }).then((ok) => ok && ui.showToast(t('settings.savedBiz')));
  };
  const panel = {
    panel: k('panel'),
    head: k('panel-h'),
    body: k('panel-b'),
  };
  return (
    <>
      <section className={panel.panel}>
        <div className={panel.head}>
          <h2>{t('settings.payments')}</h2>
        </div>
        <div className={panel.body}>
          <Field id="bk" label={t('settings.bakong')} error={err}>
            <input
              id="bk"
              value={bakong}
              disabled={!!owner && owner !== 'OWNER'}
              placeholder="name@bank"
              autoCapitalize="none"
              spellCheck={false}
              style={{ fontFamily: 'var(--f-mono)' }}
              onChange={(e) => setBakong(e.target.value)}
              onBlur={commit}
            />
          </Field>
          <span className={k('hint')}>
            {owner && owner !== 'OWNER' ? tt('ownerOnlyPayout') : t('settings.bakongHint')}
          </span>
        </div>
      </section>
      <VerificationPanel
        businessId={b.id}
        bakongId={b.bakongId}
        {...panel}
        btn={k('btn btn-ghost btn-sm')}
        onToast={ui.showToast}
      />
      <PayoutsPanel businessId={b.id} {...panel} />
    </>
  );
}

function BusinessForm() {
  const { t } = useFmt();
  const d = useData();
  const ui = useUi();
  const save = useSaveBusiness();
  const b = d.business;
  const [name, setName] = useState(b.name);
  const [about, setAbout] = useState(b.about ?? '');
  const [phone, setPhone] = useState(formatPhone(b.phone));
  const [email, setEmail] = useState(b.email ?? '');
  const [address, setAddress] = useState(b.address);
  const [err, setErr] = useState<{ bn?: string; bp?: string }>({});
  return (
    <form
      className={k('panel')}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const n = name.trim();
        const x = {
          bn: n.length < 2 ? t('settings.errName') : '',
          bp: isValidPhone(phone) ? '' : t('settings.errPhone'),
        };
        setErr(x);
        if (x.bn || x.bp) return;
        void save({
          name: n,
          about: about.trim(),
          phone: normalizePhone(phone),
          email: email.trim(),
          address: address.trim(),
        } satisfies Partial<ProviderBusinessState>).then(
          (ok) => ok && ui.showToast(t('settings.savedBiz')),
        );
      }}
    >
      <div className={k('panel-b')}>
        <Field id="bn" label={t('settings.name')} error={err.bn ?? ''}>
          <input id="bn" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="ba" label={t('settings.about')}>
          <textarea
            id="ba"
            maxLength={300}
            value={about}
            onChange={(e) => setAbout(e.target.value)}
          />
        </Field>
        <div className={k('g2')}>
          <Field id="bp" label={t('settings.phone')} error={err.bp ?? ''}>
            <input
              id="bp"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field id="be" label={t('settings.email')}>
            <input id="be" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>
        <Field id="bd" label={t('settings.address')}>
          <input id="bd" value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className={k('btn btn-primary')}>
            {t('settings.save')}
          </button>
        </div>
      </div>
    </form>
  );
}

function Hours() {
  const f = useFmt();
  const { t, locale } = f;
  const d = useData();
  const ui = useUi();
  const save = useSaveBusiness();
  const today = todayIso();
  const closures = [...d.business.closures].sort((a, b) => a.date.localeCompare(b.date));

  const addClosure = async () => {
    const r = await ui.confirm({
      title: t('settings.addClosure'),
      ok: t('settings.add'),
      extra: h(
        'div',
        { className: k('g2') },
        h(
          'div',
          { className: k('field') },
          h('label', { htmlFor: 'cd' }, t('settings.date')),
          h('input', {
            type: 'date',
            id: 'cd',
            'data-k': 'date',
            defaultValue: addDays(today, 1),
            min: today,
          }),
        ),
        h(
          'div',
          { className: k('field') },
          h('label', { htmlFor: 'cr2' }, t('settings.reason')),
          h('input', { id: 'cr2', 'data-k': 'reason', defaultValue: t('settings.defaultReason') }),
        ),
      ),
    });
    if (!r || !isIsoDate(r.date)) return;
    const date = r.date;
    const hit = d.appointments.filter(
      (x) => x.date === date && ['BOOKED', 'CONFIRMED', 'REQUESTED'].includes(x.status),
    ).length;
    const ok = await save({
      closures: [
        ...d.business.closures,
        { date, reason: r.reason || t('settings.fallbackReason') },
      ],
    });
    if (!ok) return;
    ui.showToast(
      hit
        ? t('settings.closedHit', { date: fmtD(date, locale), n: hit })
        : t('settings.closedOk', { date: fmtD(date, locale) }),
    );
  };

  return (
    <>
      <section className={k('panel')}>
        <div className={k('panel-h')}>
          <h2>{t('settings.hoursTitle')}</h2>
          <span className={k('hint')}>{t('settings.hoursHint')}</span>
        </div>
        <div className={k('panel-b hours')}>
          {DAYS.map((i) => {
            const hr = d.business.hours[i];
            const day = t(`days.long.${i}`);
            return (
              <div key={i} className={k('hour')}>
                <span>{day}</span>
                <label className={k('sw')}>
                  <input
                    type="checkbox"
                    checked={!!hr}
                    aria-label={t('settings.openDay', { day })}
                    onChange={(e) => {
                      const on = e.target.checked;
                      const hours = [...d.business.hours] as typeof d.business.hours;
                      hours[i] = on ? [540, 1080] : null;
                      void save({ hours }).then(
                        (ok) =>
                          ok &&
                          ui.showToast(on ? t('settings.toastOpen') : t('settings.toastClosed')),
                      );
                    }}
                  />
                  <span />
                </label>
                <span>
                  {hr ? (
                    <>
                      <HourInput i={i} which={0} label={t('settings.opens', { day })} />
                      {' – '}
                      <HourInput i={i} which={1} label={t('settings.closes', { day })} />
                    </>
                  ) : (
                    <span className={k('muted')}>{t('settings.closed')}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </section>
      <section className={k('panel')}>
        <div className={k('panel-h')}>
          <h2>{t('settings.closuresTitle')}</h2>
          <button
            type="button"
            className={k('btn btn-ghost btn-sm')}
            onClick={() => void addClosure()}
          >
            <PIcon name="plus" size={16} />
            {t('settings.add')}
          </button>
        </div>
        <div className={k('panel-b')}>
          {closures.length ? (
            closures.map((c) => (
              <div
                key={c.date}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>
                  <b className={k('num')}>{fmtD(c.date, locale)}</b> · {c.reason}
                </span>
                <button
                  type="button"
                  className={k('link quiet small')}
                  onClick={() =>
                    void save({
                      closures: d.business.closures.filter((x) => x.date !== c.date),
                    }).then((ok) => ok && ui.showToast(t('settings.closureRemoved')))
                  }
                >
                  {t('settings.remove')}
                </button>
              </div>
            ))
          ) : (
            <span className={k('muted')}>{t('settings.nonePlanned')}</span>
          )}
        </div>
      </section>
    </>
  );
}

/** Hour input saved on change; reverts with a toast when closing ≤ opening. */
function HourInput({ i, which, label }: { i: number; which: 0 | 1; label: string }) {
  const { t } = useFmt();
  const d = useData();
  const ui = useUi();
  const save = useSaveBusiness();
  const hr = d.business.hours[i]!;
  const [v, setV] = useState(hm(hr[which]));
  return (
    <input
      type="time"
      step={3600}
      aria-label={label}
      value={v}
      onChange={(e) => {
        const val = e.target.value;
        setV(val);
        if (!val) return;
        const m = Math.round(toMin(val) / 60) * 60;
        const next: [number, number] = which === 0 ? [m, hr[1]] : [hr[0], m];
        if (next[0] >= next[1]) {
          setV(hm(hr[which]));
          ui.showToast(t('settings.errOrder'));
          return;
        }
        const hours = [...d.business.hours] as typeof d.business.hours;
        hours[i] = next;
        setV(hm(m));
        void save({ hours }).then((ok) => ok && ui.showToast(t('settings.hoursSaved')));
      }}
    />
  );
}

function Rules() {
  const { t } = useFmt();
  const d = useData();
  const ui = useUi();
  const save = useSaveBusiness();
  const b = d.business;
  const toggle = (key: Toggle, label: string, hint: string) => (
    <label className={k('swr')}>
      <span>
        <strong>{label}</strong>
        <span className={k('hint')}>{hint}</span>
      </span>
      <span className={k('sw')}>
        <input
          type="checkbox"
          checked={b[key]}
          onChange={(e) => {
            const on = e.target.checked;
            void save({ [key]: on }).then((ok) => ok && ui.showToast(t('settings.saved')));
          }}
        />
        <span />
      </span>
    </label>
  );
  const select = (key: Sel, id: string, label: string, opts: [number, string][]) => (
    <Field id={id} label={label}>
      <select
        id={id}
        value={b[key]}
        onChange={(e) => {
          const v = Number(e.target.value);
          void save({ [key]: v }).then((ok) => ok && ui.showToast(t('settings.saved')));
        }}
      >
        {opts.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Field>
  );
  return (
    <section className={k('panel')}>
      <div className={k('panel-b')}>
        {toggle('online', t('settings.ruleOnline'), t('settings.ruleOnlineHint'))}
        {toggle('autoConfirm', t('settings.ruleAuto'), t('settings.ruleAutoHint'))}
        {toggle('reminder', t('settings.ruleReminder'), t('settings.ruleReminderHint'))}
        <div className={k('g3')}>
          {select('minNoticeHours', 'r1', t('settings.notice'), [
            [0, t('settings.none')],
            [1, t('settings.h1')],
            [2, t('settings.h2')],
            [24, t('settings.d1')],
          ])}
          {select(
            'freeCancelHours',
            'r2',
            t('settings.cancelUntil'),
            [2, 12, 24].map((n) => [n, t('settings.hBefore', { n })]),
          )}
          {select(
            'bufferMinutes',
            'r3',
            t('settings.gap'),
            [0, 10, 15].map((n) => [n, n ? t('settings.gapMin', { n }) : t('settings.none')]),
          )}
        </div>
      </div>
    </section>
  );
}
