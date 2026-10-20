'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { api, type ApiDistrict } from '@/lib/api';
import type { Business, Closure, DeliveryZone, ShopPolicy, WeekRanges } from '@/lib/domain';
import { policyOf } from '@/lib/shop';
import { cn } from '@/lib/utils/cn';

import { useSaveState } from '../useSaveState';
import c from './settings.module.css';

/** Save a raw `PATCH /api/businesses/{id}` body; resolves whether it worked. */
export type SaveBusiness = (patch: Record<string, unknown>) => Promise<boolean>;

interface PanelProps {
  business: Business;
  save: SaveBusiness;
  /** False for roles that can't change settings (the API refuses anyway). */
  canEdit: boolean;
}

function Panel({
  title,
  sub,
  children,
  onSave,
  canEdit,
  dirty,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  onSave: () => Promise<boolean>;
  canEdit: boolean;
  dirty: boolean;
}) {
  const t = useTranslations('shopSettings');
  const { state, run } = useSaveState();
  return (
    <section className={c.panel} aria-label={title}>
      <div className={c.head}>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      <fieldset disabled={!canEdit} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        <div className={c.body}>{children}</div>
      </fieldset>
      {canEdit && (
        <div className={c.foot}>
          <span
            className={cn(
              c.status,
              state === 'saved' && !dirty && c.statusOk,
              state === 'failed' && c.statusBad,
            )}
            role="status"
          >
            {dirty
              ? t('unsaved')
              : state === 'saved'
                ? t('saved')
                : state === 'failed'
                  ? t('failed')
                  : ''}
          </span>
          <button
            type="button"
            className={c.primary}
            disabled={!dirty || state === 'saving'}
            onClick={() => void run(onSave)}
          >
            {state === 'saving' ? t('saving') : t('save')}
          </button>
        </div>
      )}
    </section>
  );
}

const useDistricts = () =>
  useQuery({
    queryKey: ['meta', 'districts'],
    queryFn: () => api.get<ApiDistrict[]>('/meta/districts', { auth: false }),
    staleTime: 60 * 60_000,
  });

// ── Location and contact ──────────────────────────────────────────────────────────────

/** District, street, email and the map pin customers and riders use. */
export function LocationPanel({ business, save, canEdit }: PanelProps) {
  const t = useTranslations('shopSettings.location');
  const { data: districts } = useDistricts();
  const initial = {
    district: business.district,
    street: business.street,
    email: business.email ?? '',
    lat: business.lat != null ? String(business.lat) : '',
    lng: business.lng != null ? String(business.lng) : '',
  };
  const [f, setF] = useState(initial);
  const [err, setErr] = useState('');
  const [locating, setLocating] = useState(false);
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = (k: keyof typeof f, v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    setErr('');
  };
  const pinOk =
    (f.lat === '' && f.lng === '') ||
    (isFinite(+f.lat) && isFinite(+f.lng) && f.lat !== '' && f.lng !== '');

  const onSave = async () => {
    if (f.street.trim().length < 3) {
      setErr(t('errStreet'));
      return false;
    }
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) {
      setErr(t('errEmail'));
      return false;
    }
    if (!pinOk) {
      setErr(t('errPin'));
      return false;
    }
    return save({
      district: f.district,
      street: f.street.trim(),
      email: f.email.trim(),
      ...(f.lat !== '' ? { lat: +f.lat, lng: +f.lng } : {}),
    });
  };

  return (
    <Panel title={t('title')} sub={t('sub')} onSave={onSave} canEdit={canEdit} dirty={dirty}>
      <div className={c.g2}>
        <label className={c.field}>
          {t('district')}
          <select value={f.district} onChange={(e) => set('district', e.target.value)}>
            {(districts ?? [{ id: f.district, name: f.district } as ApiDistrict]).map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className={c.field}>
          {t('street')}
          <input value={f.street} maxLength={200} onChange={(e) => set('street', e.target.value)} />
        </label>
      </div>
      <label className={c.field}>
        {t('email')}
        <input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
        <span className={c.hint}>{t('emailHint')}</span>
      </label>
      <div className={c.field}>
        {t('pin')}
        <div className={c.g2}>
          <input
            aria-label={t('lat')}
            placeholder={t('lat')}
            inputMode="decimal"
            value={f.lat}
            onChange={(e) => set('lat', e.target.value.trim())}
          />
          <input
            aria-label={t('lng')}
            placeholder={t('lng')}
            inputMode="decimal"
            value={f.lng}
            onChange={(e) => set('lng', e.target.value.trim())}
          />
        </div>
        <div className={c.row}>
          <button
            type="button"
            className={c.ghost}
            disabled={locating || typeof navigator === 'undefined' || !navigator.geolocation}
            onClick={() => {
              setLocating(true);
              navigator.geolocation.getCurrentPosition(
                (p) => {
                  setLocating(false);
                  setF((x) => ({
                    ...x,
                    lat: p.coords.latitude.toFixed(6),
                    lng: p.coords.longitude.toFixed(6),
                  }));
                },
                () => {
                  setLocating(false);
                  setErr(t('errLocate'));
                },
                { enableHighAccuracy: true, timeout: 10_000 },
              );
            }}
          >
            {locating ? t('locating') : t('useMyLocation')}
          </button>
          {f.lat && f.lng && pinOk && (
            <a
              className={c.ghost}
              href={`https://www.google.com/maps?q=${f.lat},${f.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              {t('openMap')}
            </a>
          )}
        </div>
        <span className={c.hint}>{t('pinHint')}</span>
      </div>
      {err && (
        <p className={c.err} role="alert">
          {err}
        </p>
      )}
    </Panel>
  );
}

// ── Receipts, VAT, payment methods and links ─────────────────────────────────────────

const LINKS = ['facebook', 'telegram', 'instagram', 'tiktok', 'website'] as const;

/** What receipts say, VAT, which payment methods the counter takes, and the shop's links. */
export function PolicyPanel({ business, save, canEdit }: PanelProps) {
  const t = useTranslations('shopSettings.policy');
  const p = policyOf(business.policy);
  const initial = {
    receiptHeader: p.receiptHeader ?? '',
    receiptFooter: p.receiptFooter ?? '',
    taxPct: String(Number(p.taxPct)),
    taxId: p.taxId ?? '',
    payCash: p.payCash,
    payKhqr: p.payKhqr,
    payCard: p.payCard,
    ...Object.fromEntries(LINKS.map((k) => [k, (p[k] as string | null | undefined) ?? ''])),
  } as Record<string, string | boolean>;
  const [f, setF] = useState(initial);
  const [err, setErr] = useState('');
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = (k: string, v: string | boolean) => {
    setF((x) => ({ ...x, [k]: v }));
    setErr('');
  };
  const tax = Number(f.taxPct);

  const onSave = async () => {
    if (!(tax >= 0 && tax <= 20) || !/^\d+(\.\d{1,2})?$/.test(String(f.taxPct))) {
      setErr(t('errTax'));
      return false;
    }
    if (f.taxId && !/^[A-Za-z0-9-]{4,20}$/.test(String(f.taxId))) {
      setErr(t('errTaxId'));
      return false;
    }
    if (!f.payCash && !f.payKhqr && !f.payCard) {
      setErr(t('errPay'));
      return false;
    }
    const policy: Partial<ShopPolicy> = {
      receiptHeader: String(f.receiptHeader).trim(),
      receiptFooter: String(f.receiptFooter).trim(),
      taxPct: tax,
      taxId: String(f.taxId).trim(),
      payCash: !!f.payCash,
      payKhqr: !!f.payKhqr,
      payCard: !!f.payCard,
      ...Object.fromEntries(LINKS.map((k) => [k, String(f[k]).trim()])),
    };
    return save({ policy });
  };

  return (
    <Panel title={t('title')} sub={t('sub')} onSave={onSave} canEdit={canEdit} dirty={dirty}>
      <label className={c.field}>
        {t('receiptHeader')}
        <input
          value={String(f.receiptHeader)}
          maxLength={120}
          placeholder={t('receiptHeaderPh')}
          onChange={(e) => set('receiptHeader', e.target.value)}
        />
      </label>
      <label className={c.field}>
        {t('receiptFooter')}
        <textarea
          value={String(f.receiptFooter)}
          maxLength={300}
          placeholder={t('receiptFooterPh')}
          onChange={(e) => set('receiptFooter', e.target.value)}
        />
      </label>
      <div className={c.g2}>
        <label className={c.field}>
          {t('taxPct')}
          <input
            inputMode="decimal"
            value={String(f.taxPct)}
            onChange={(e) => set('taxPct', e.target.value.trim())}
          />
          <span className={c.hint}>{t('taxHint')}</span>
        </label>
        <label className={c.field}>
          {t('taxId')}
          <input
            value={String(f.taxId)}
            maxLength={20}
            placeholder="K001-901234567"
            onChange={(e) => set('taxId', e.target.value)}
          />
        </label>
      </div>
      <div className={c.field} role="group" aria-label={t('payTitle')}>
        {t('payTitle')}
        {(['payCash', 'payKhqr', 'payCard'] as const).map((k) => (
          <label key={k} className={c.check}>
            <input type="checkbox" checked={!!f[k]} onChange={(e) => set(k, e.target.checked)} />
            <span>
              {t(k)}
              <small>{t(`${k}Hint`)}</small>
            </span>
          </label>
        ))}
      </div>
      <div className={c.g2}>
        {LINKS.map((k) => (
          <label key={k} className={c.field}>
            {t(`link.${k}`)}
            <input
              value={String(f[k])}
              maxLength={200}
              placeholder={t(`linkPh.${k}`)}
              onChange={(e) => set(k, e.target.value)}
            />
          </label>
        ))}
      </div>
      {err && (
        <p className={c.err} role="alert">
          {err}
        </p>
      )}
    </Panel>
  );
}

// ── Opening hours and closures ───────────────────────────────────────────────────────

const toTime = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMin = (v: string) => {
  const [h, m] = v.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Opening hours to the quarter hour, and dates the shop is closed. */
export function HoursPanel({ business, save, canEdit }: PanelProps) {
  const t = useTranslations('shopSettings.hours');
  const td = useTranslations('shopSettings.days');
  const initial = { hours: business.hours, closures: business.closures ?? [] };
  const [hours, setHours] = useState<WeekRanges>(initial.hours);
  const [closures, setClosures] = useState<Closure[]>(initial.closures);
  const [newDate, setNewDate] = useState('');
  const [newReason, setNewReason] = useState('');
  const [err, setErr] = useState('');
  const dirty = JSON.stringify({ hours, closures }) !== JSON.stringify(initial);
  const setDay = (i: number, v: [number, number] | null) =>
    setHours((h) => h.map((d, k) => (k === i ? v : d)) as WeekRanges);

  const onSave = async () => {
    if (hours.some((d) => d && d[1] <= d[0])) {
      setErr(t('errRange'));
      return false;
    }
    return save({ hours, closures });
  };

  return (
    <Panel title={t('title')} sub={t('sub')} onSave={onSave} canEdit={canEdit} dirty={dirty}>
      <div>
        {hours.map((d, i) => (
          <div key={i} className={c.day}>
            <span>{td(String(i) as '0')}</span>
            <label className={c.check}>
              <input
                type="checkbox"
                checked={!!d}
                aria-label={t('openOn', { day: td(String(i) as '0') })}
                onChange={(e) => setDay(i, e.target.checked ? [540, 1080] : null)}
              />
              {d ? t('open') : t('closed')}
            </label>
            {d ? (
              <span className={c.times}>
                <input
                  type="time"
                  step={900}
                  aria-label={t('opens', { day: td(String(i) as '0') })}
                  value={toTime(d[0])}
                  onChange={(e) => setDay(i, [toMin(e.target.value), d[1]])}
                />
                –
                <input
                  type="time"
                  step={900}
                  aria-label={t('closes', { day: td(String(i) as '0') })}
                  value={toTime(d[1])}
                  onChange={(e) => setDay(i, [d[0], toMin(e.target.value)])}
                />
              </span>
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>
      <div className={c.field}>
        {t('closures')}
        {closures.length === 0 && <span className={c.muted}>{t('noClosures')}</span>}
        {closures.map((x) => (
          <div key={x.date} className={c.row}>
            <span>
              {x.date} · {x.reason}
            </span>
            <button
              type="button"
              className={c.icon}
              aria-label={t('removeClosure', { date: x.date })}
              onClick={() => setClosures((cs) => cs.filter((y) => y.date !== x.date))}
            >
              ×
            </button>
          </div>
        ))}
        <div className={c.row}>
          <input
            type="date"
            aria-label={t('closureDate')}
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            style={{ minHeight: 36 }}
          />
          <input
            aria-label={t('closureReason')}
            placeholder={t('closureReasonPh')}
            value={newReason}
            maxLength={80}
            onChange={(e) => setNewReason(e.target.value)}
            style={{ minHeight: 36, flex: 1 }}
          />
          <button
            type="button"
            className={c.ghost}
            disabled={!newDate || closures.some((x) => x.date === newDate)}
            onClick={() => {
              setClosures((cs) =>
                [...cs, { date: newDate, reason: newReason.trim() || t('closedDefault') }].sort(
                  (a, b) => a.date.localeCompare(b.date),
                ),
              );
              setNewDate('');
              setNewReason('');
            }}
          >
            {t('addClosure')}
          </button>
        </div>
      </div>
      {err && (
        <p className={c.err} role="alert">
          {err}
        </p>
      )}
    </Panel>
  );
}

// ── Delivery zones (product shops) ───────────────────────────────────────────────────

/** The shop's delivery zones: which districts each covers and its fee. */
export function DeliveryZonesPanel({
  business,
  save,
  canEdit,
}: PanelProps & { business: Extract<Business, { type: 'PRODUCT' }> }) {
  const t = useTranslations('shopSettings.zones');
  const { data: districts } = useDistricts();
  const initial = business.productSettings.zones.map((z) => ({ ...z, fee: String(z.fee) }));
  const [zones, setZones] = useState(initial);
  const [err, setErr] = useState('');
  const dirty = JSON.stringify(zones) !== JSON.stringify(initial);
  const setZone = (i: number, patch: Partial<(typeof zones)[number]>) =>
    setZones((zs) => zs.map((z, k) => (k === i ? { ...z, ...patch } : z)));
  const owner = (name: string) => zones.findIndex((z) => z.districts.includes(name));

  const onSave = async () => {
    for (const z of zones) {
      if (z.label.trim().length < 2) {
        setErr(t('errLabel'));
        return false;
      }
      if (!(Number(z.fee) >= 0) || z.fee === '') {
        setErr(t('errFee'));
        return false;
      }
      if (!z.districts.length) {
        setErr(t('errDistricts'));
        return false;
      }
    }
    const out: DeliveryZone[] = zones.map((z) => ({
      label: z.label.trim(),
      districts: z.districts,
      fee: Number(z.fee),
    }));
    return save({ productSettings: { zones: out } });
  };

  return (
    <Panel title={t('title')} sub={t('sub')} onSave={onSave} canEdit={canEdit} dirty={dirty}>
      {zones.map((z, i) => (
        <div key={i} className={c.zone}>
          <div className={c.zoneTop}>
            <label className={c.field}>
              {t('label')}
              <input
                value={z.label}
                maxLength={80}
                onChange={(e) => setZone(i, { label: e.target.value })}
              />
            </label>
            <label className={c.field}>
              {t('fee')}
              <input
                inputMode="decimal"
                value={z.fee}
                onChange={(e) => setZone(i, { fee: e.target.value.trim() })}
              />
            </label>
            <button
              type="button"
              className={c.icon}
              aria-label={t('remove', { label: z.label })}
              onClick={() => setZones((zs) => zs.filter((_, k) => k !== i))}
            >
              ×
            </button>
          </div>
          <div className={c.chips} role="group" aria-label={t('districtsOf', { label: z.label })}>
            {(districts ?? []).map((d) => {
              const on = z.districts.includes(d.name);
              const other = owner(d.name);
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={on}
                  className={cn(c.chip, on && c.chipOn, !on && other >= 0 && c.chipTaken)}
                  title={
                    !on && other >= 0 ? t('inZone', { label: zones[other]!.label }) : undefined
                  }
                  onClick={() =>
                    setZones((zs) =>
                      zs.map((x, k) =>
                        k === i
                          ? {
                              ...x,
                              districts: on
                                ? x.districts.filter((n) => n !== d.name)
                                : [...x.districts, d.name],
                            }
                          : // A district belongs to one zone.
                            { ...x, districts: x.districts.filter((n) => n !== d.name) },
                      ),
                    )
                  }
                >
                  {d.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button
        type="button"
        className={c.ghost}
        style={{ justifySelf: 'start' }}
        onClick={() =>
          setZones((zs) => [
            ...zs,
            { label: t('newZone', { n: zs.length + 1 }), districts: [], fee: '1.00' },
          ])
        }
      >
        {t('add')}
      </button>
      <span className={c.hint}>{t('hint')}</span>
      {err && (
        <p className={c.err} role="alert">
          {err}
        </p>
      )}
    </Panel>
  );
}

// ── Returns (product shops) ──────────────────────────────────────────────────────────

/** How many days after delivery or pickup the shop accepts a return (its own policy). */
export function ReturnWindow({
  business,
  save,
  canEdit,
}: PanelProps & { business: Extract<Business, { type: 'PRODUCT' }> }) {
  const t = useTranslations('shopSettings.returns');
  const initial = String(business.productSettings.returnDays ?? 7);
  const [days, setDays] = useState(initial);
  return (
    <Panel
      title={t('title')}
      sub={t('sub')}
      onSave={() => save({ productSettings: { returnDays: Number(days) } })}
      canEdit={canEdit}
      dirty={days !== initial}
    >
      <label className={c.field}>
        {t('label')}
        <select value={days} onChange={(e) => setDays(e.target.value)}>
          {[...new Set([0, 3, 7, 14, 30, Number(initial)])]
            .sort((a, b) => a - b)
            .map((d) => (
              <option key={d} value={d}>
                {d === 0 ? t('none') : t('days', { n: d })}
              </option>
            ))}
        </select>
        <span className={c.hint}>{t('hint')}</span>
      </label>
    </Panel>
  );
}
