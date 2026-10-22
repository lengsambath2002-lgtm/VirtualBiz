'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { apiDownload, isApiError, saveBlob } from '@/lib/api';
import type { BusinessType } from '@/lib/domain';
import { cn } from '@/lib/utils/cn';
import { DateRangePicker } from '@/components/data';
import { ppDay, rangeOf } from '@/lib/utils/dateRange';

import c from './settings.module.css';

type Kind = 'orders' | 'sales' | 'products' | 'appointments' | 'customers';
const KINDS: Record<BusinessType, Kind[]> = {
  PRODUCT: ['orders', 'sales', 'products', 'customers'],
  SERVICE: ['appointments', 'sales', 'customers'],
};
const DATED: Kind[] = ['orders', 'sales', 'appointments'];
const RANGES = ['last7', 'last30', 'last90', 'thisMonth', 'lastMonth', 'last365'] as const;

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
  const [range, setRange] = useState(() => rangeOf('last30'));
  const [busy, setBusy] = useState<Kind | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const download = async (kind: Kind) => {
    setBusy(kind);
    setNote(null);
    const q = DATED.includes(kind) ? `?${new URLSearchParams(range)}` : '';
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
            <div className={c.field} style={{ maxWidth: 320 }}>
              <span>{t('range')}</span>
              <DateRangePicker
                label={t('range')}
                variant="field"
                from={range.from}
                to={range.to}
                clearable={false}
                presets={RANGES}
                max={ppDay(new Date())}
                onChange={(from, to) => setRange({ from, to })}
              />
            </div>
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
