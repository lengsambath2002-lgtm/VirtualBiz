'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { apiDownload, isApiError, saveBlob } from '@/lib/api';
import type { BusinessType } from '@/lib/domain';
import { cn } from '@/lib/utils/cn';

import c from './settings.module.css';

type Kind = 'orders' | 'sales' | 'products' | 'appointments' | 'customers';
const KINDS: Record<BusinessType, Kind[]> = {
  PRODUCT: ['orders', 'sales', 'products', 'customers'],
  SERVICE: ['appointments', 'sales', 'customers'],
};
const DATED: Kind[] = ['orders', 'sales', 'appointments'];
const RANGES = ['last7', 'last30', 'last90', 'thisMonth', 'lastMonth', 'last365'] as const;
type Range = (typeof RANGES)[number];

/** A Phnom Penh calendar day as YYYY-MM-DD (the API's export days). */
const day = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh' }).format(d);

export function rangeOf(r: Range, now = new Date()): { from: string; to: string } {
  const [y, m, dd] = day(now).split('-').map(Number) as [number, number, number];
  const at = (yy: number, mm: number, d2: number) => day(new Date(Date.UTC(yy, mm - 1, d2, 12)));
  switch (r) {
    case 'thisMonth':
      return { from: at(y, m, 1), to: at(y, m, dd) };
    case 'lastMonth':
      return { from: at(y, m - 1, 1), to: at(y, m, 0) };
    default: {
      const n = { last7: 7, last30: 30, last90: 90, last365: 365 }[r];
      return { from: at(y, m, dd - n + 1), to: at(y, m, dd) };
    }
  }
}

/**
 * "Export data" (docs/api/phase14-customers-exports.md): CSV files of the shop's records for a
 * spreadsheet or an accountant. Owners and managers only: the files hold customers' details.
 */
export function ExportPanel({
  businessId,
  type,
  canExport,
}: {
  businessId: string;
  type: BusinessType;
  canExport: boolean;
}) {
  const t = useTranslations('shopSettings.export');
  const [range, setRange] = useState<Range>('last30');
  const [busy, setBusy] = useState<Kind | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const download = async (kind: Kind) => {
    setBusy(kind);
    setNote(null);
    const q = DATED.includes(kind) ? `?${new URLSearchParams(rangeOf(range))}` : '';
    try {
      const { blob, filename } = await apiDownload(`/exports/${kind}${q}`, { businessId });
      const name = filename ?? `${kind}.csv`;
      saveBlob(blob, name);
      setNote({ ok: true, text: t('done', { file: name }) });
    } catch (e) {
      setNote({ ok: false, text: isApiError(e, 'FORBIDDEN') ? t('forbidden') : t('failed') });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={c.panel} aria-label={t('title')}>
      <div className={c.head}>
        <h2>{t('title')}</h2>
        <p>{t('sub')}</p>
      </div>
      <div className={c.body}>
        {!canExport ? (
          <p className={c.muted}>{t('ownerOnly')}</p>
        ) : (
          <>
            <label className={c.field} style={{ maxWidth: 260 }}>
              <span>{t('range')}</span>
              <select value={range} onChange={(e) => setRange(e.target.value as Range)}>
                {RANGES.map((r) => (
                  <option key={r} value={r}>
                    {t(`ranges.${r}`)}
                  </option>
                ))}
              </select>
            </label>
            <ul className={c.exports}>
              {KINDS[type].map((k) => (
                <li key={k} className={c.export}>
                  <div>
                    <strong>{t(`kind.${k}`)}</strong>
                    <span>
                      {t(`kindSub.${k}`)}
                      {DATED.includes(k) ? '' : ` ${t('allTime')}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={c.ghost}
                    disabled={busy !== null}
                    aria-label={t('downloadOf', { what: t(`kind.${k}`) })}
                    onClick={() => void download(k)}
                  >
                    {busy === k ? t('preparing') : t('download')}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {note && (
        <div className={c.foot} style={{ justifyContent: 'flex-start' }}>
          <span className={cn(c.status, note.ok ? c.statusOk : c.statusBad)} role="status">
            {note.text}
          </span>
        </div>
      )}
    </section>
  );
}
