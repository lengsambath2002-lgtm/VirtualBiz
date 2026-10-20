'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ShopPhotos } from '@/components/media';
import { useMyRole } from '@/features/account-switcher';
import { PayoutsPanel, VerificationPanel } from '@/features/business-status';
import { HoursPanel, LocationPanel, PolicyPanel } from '@/features/shop-settings';
import { formatPhone, isValidPhone, normalizePhone } from '@/lib/utils/phone';

import { PIcon } from '@/features/provider-shared/components/Icon';
import { Field } from '@/features/provider-shared/components/Overlay';
import { k } from '@/features/provider-shared/cx';
import { useFmt } from '@/features/provider-shared/hooks/useFmt';
import {
  toApiBusiness,
  useSaveBusiness,
  useSaveBusinessRaw,
} from '@/features/provider-shared/hooks/useSaveBusiness';
import { useData, useUi } from '@/features/provider-shared/store';
import type { ProviderBusinessState } from '@/features/provider-shared/types';

type Toggle = 'online' | 'autoConfirm';
type Sel =
  | 'minNoticeHours'
  | 'freeCancelHours'
  | 'bufferMinutes'
  | 'slotMinutes'
  | 'maxDaysAhead'
  | 'reminderHours';

/** Settings: business, hours & closures, booking rules (prototype `P.settings`). */
export function SettingsPage() {
  const { t } = useFmt();
  const ui = useUi();
  const tab = ui.setTab;
  // What this member's role may change (docs/api/phase10-shop-team.md); the API enforces it.
  const data = useData();
  const role = useMyRole(data.business.id);
  const api = toApiBusiness(data.business);
  const saveRaw = useSaveBusinessRaw();
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
              <LocationPanel business={api} save={saveRaw} canEdit={role !== 'STAFF'} />
              <PolicyPanel business={api} save={saveRaw} canEdit={role !== 'STAFF'} />
              <BusinessPayments />
            </>
          ) : tab === 'hours' ? (
            <HoursPanel business={api} save={saveRaw} canEdit={role !== 'STAFF'} />
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
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className={k('btn btn-primary')}>
            {t('settings.save')}
          </button>
        </div>
      </div>
    </form>
  );
}

function Rules() {
  const { t } = useFmt();
  const d = useData();
  const ui = useUi();
  const save = useSaveBusiness();
  const b = d.business;
  const saved = (ok: boolean) => ok && ui.showToast(t('settings.saved'));
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
          onChange={(e) => void save({ [key]: e.target.checked }).then(saved)}
        />
        <span />
      </span>
    </label>
  );
  /** A choice list that always contains the current value (set earlier or elsewhere). */
  const select = (
    key: Sel,
    id: string,
    label: string,
    values: number[],
    name: (n: number) => string,
  ) => (
    <Field id={id} label={label}>
      <select
        id={id}
        value={b[key]}
        onChange={(e) => void save({ [key]: Number(e.target.value) }).then(saved)}
      >
        {[...new Set([...values, b[key]])]
          .sort((x, y) => x - y)
          .map((v) => (
            <option key={v} value={v}>
              {name(v)}
            </option>
          ))}
      </select>
    </Field>
  );
  const before = (n: number) => (n ? t('settings.hBefore', { n }) : t('settings.none'));
  return (
    <>
      <section className={k('panel')}>
        <div className={k('panel-b')}>
          {toggle('online', t('settings.ruleOnline'), t('settings.ruleOnlineHint'))}
          {toggle('autoConfirm', t('settings.ruleAuto'), t('settings.ruleAutoHint'))}
          <div className={k('g3')}>
            {select('minNoticeHours', 'r1', t('settings.notice'), [0, 1, 2, 4, 12, 24, 48], (n) =>
              n ? t('settings.hAhead', { n }) : t('settings.none'),
            )}
            {select(
              'freeCancelHours',
              'r2',
              t('settings.cancelUntil'),
              [0, 2, 4, 12, 24, 48],
              before,
            )}
            {select('bufferMinutes', 'r3', t('settings.gap'), [0, 5, 10, 15, 20, 30], (n) =>
              n ? t('settings.gapMin', { n }) : t('settings.none'),
            )}
          </div>
          <div className={k('g3')}>
            {select('slotMinutes', 'r4', t('settings.slot'), [5, 10, 15, 20, 30, 45, 60], (n) =>
              t('settings.everyMin', { n }),
            )}
            {select('maxDaysAhead', 'r5', t('settings.ahead'), [7, 14, 30, 60, 90, 180], (n) =>
              t('settings.upToDays', { n }),
            )}
            {select(
              'reminderHours',
              'r6',
              t('settings.reminderWhen'),
              [0, 2, 4, 12, 24, 48],
              (n) => (n ? t('settings.hBefore', { n }) : t('settings.reminderOff')),
            )}
          </div>
        </div>
      </section>
      <TipPresets />
    </>
  );
}

/** Tip choices offered at checkout (percent, up to 5). */
function TipPresets() {
  const { t } = useFmt();
  const ui = useUi();
  const save = useSaveBusiness();
  const b = useData().business;
  const [vals, setVals] = useState(b.tipPresets.map(String));
  const [err, setErr] = useState('');
  const commit = (next: string[]) => {
    const nums = next.map(Number);
    if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 50)) {
      setErr(t('settings.errTip'));
      return;
    }
    setErr('');
    const clean = [...new Set(nums)].sort((x, y) => x - y);
    if (JSON.stringify(clean) === JSON.stringify(b.tipPresets)) return;
    void save({ tipPresets: clean }).then((ok) => ok && ui.showToast(t('settings.saved')));
  };
  return (
    <section className={k('panel')}>
      <div className={k('panel-h')}>
        <h2>{t('settings.tips')}</h2>
      </div>
      <div className={k('panel-b')}>
        <span className={k('hint')}>{t('settings.tipsHint')}</span>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {vals.map((v, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <input
                aria-label={t('settings.tipN', { n: i + 1 })}
                inputMode="numeric"
                value={v}
                style={{
                  width: 64,
                  height: 36,
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-sm)',
                  padding: '0 10px',
                  textAlign: 'right',
                }}
                onChange={(e) =>
                  setVals((x) => x.map((y, j) => (j === i ? e.target.value.replace(/\D/g, '') : y)))
                }
                onBlur={() => commit(vals.filter((x) => x !== ''))}
              />
              %
              <button
                type="button"
                className={k('ibtn')}
                aria-label={t('settings.tipRemove', { n: v || '?' })}
                onClick={() => {
                  const next = vals.filter((_, j) => j !== i);
                  setVals(next);
                  commit(next.filter((x) => x !== ''));
                }}
              >
                <PIcon name="x" size={16} />
              </button>
            </span>
          ))}
          {vals.length < 5 && (
            <button
              type="button"
              className={k('btn btn-ghost btn-sm')}
              onClick={() => setVals((x) => [...x, ''])}
            >
              {t('settings.tipAdd')}
            </button>
          )}
        </div>
        {err && <span className={k('err')}>{err}</span>}
      </div>
    </section>
  );
}
