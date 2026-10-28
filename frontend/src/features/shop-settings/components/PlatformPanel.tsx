'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';

import { ErrorView } from '@/components/feedback';
import { disconnectShop, shopPlatformLink } from '@/features/business-platform/api';
import { goToPlatform } from '@/features/business-platform/util/start';
import { cn } from '@/lib/utils/cn';

import c from './settings.module.css';

/**
 * "Business Platform" (docs/adr/0003-sso-with-the-business-platform.md): whether the shop is
 * linked to a platform organisation. The owner connects (a platform sign-in, then the connect
 * screen) and disconnects. Hidden while platform sign-in isn't set up on the server.
 */
export function PlatformPanel({ businessId }: { businessId: string }) {
  const t = useTranslations('platform.panel');
  const format = useFormatter();
  const qc = useQueryClient();
  const key = ['business', businessId, 'platform'];
  const q = useQuery({ queryKey: key, queryFn: () => shopPlatformLink(businessId) });
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const head = (
    <div className={c.head}>
      <h2>{t('title')}</h2>
      <p>{t('sub')}</p>
    </div>
  );
  if (q.error)
    return (
      <section className={c.panel} aria-label={t('title')}>
        {head}
        <ErrorView size="panel" error={q.error} retry={() => void q.refetch()} home={null} />
      </section>
    );
  if (!q.data)
    return (
      <section className={c.panel} aria-label={t('title')} aria-busy="true">
        {head}
      </section>
    );
  const d = q.data;
  if (!d.available && !d.linked) return null;
  const org = d.orgName || d.orgId || '';

  const connect = () => {
    setBusy(true);
    setNote(null);
    goToPlatform({ intent: 'connect', businessId }).catch(() => {
      setBusy(false);
      setNote({ ok: false, text: t('failed') });
    });
  };
  const disconnect = async () => {
    setBusy(true);
    setNote(null);
    try {
      qc.setQueryData(key, await disconnectShop(businessId));
      setAsking(false);
      setNote({ ok: true, text: t('disconnected') });
    } catch {
      setNote({ ok: false, text: t('failed') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={c.panel} aria-label={t('title')}>
      {head}
      <div className={c.body}>
        {d.linked ? (
          <p style={{ margin: 0 }}>
            <strong>{t('linked', { org })}</strong>
            {d.linkedAt && (
              <span className={c.muted}>
                {' · '}
                {t('since', {
                  date: format.dateTime(new Date(d.linkedAt), { dateStyle: 'medium' }),
                })}
              </span>
            )}
          </p>
        ) : (
          <p className={c.muted} style={{ margin: 0 }}>
            {t('notLinked')}
          </p>
        )}
        {!d.canManage && <p className={c.muted}>{t('ownerOnly')}</p>}
        {d.canManage && asking && (
          <p role="alert" style={{ margin: 0 }}>
            {t('confirm', { org })}
          </p>
        )}
      </div>
      {(d.canManage || note) && (
        <div className={c.foot} style={{ flexWrap: 'wrap' }}>
          {note && (
            <span
              className={cn(c.status, note.ok ? c.statusOk : c.statusBad)}
              role="status"
              style={{ marginRight: 'auto' }}
            >
              {note.text}
            </span>
          )}
          {d.canManage && d.available && !d.linked && (
            <button type="button" className={c.primary} disabled={busy} onClick={connect}>
              {t('connect')}
            </button>
          )}
          {d.canManage && d.linked && !asking && (
            <button
              type="button"
              className={c.ghost}
              disabled={busy}
              onClick={() => setAsking(true)}
            >
              {t('disconnect')}
            </button>
          )}
          {d.canManage && d.linked && asking && (
            <>
              <button
                type="button"
                className={c.ghost}
                disabled={busy}
                onClick={() => setAsking(false)}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className={c.primary}
                disabled={busy}
                onClick={() => void disconnect()}
              >
                {busy ? t('disconnecting') : t('confirmYes')}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
