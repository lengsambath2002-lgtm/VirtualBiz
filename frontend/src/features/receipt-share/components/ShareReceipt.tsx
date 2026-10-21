'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { api } from '@/lib/api';

/**
 * Share a sale's receipt from the shop's own phone (docs/api/phase13-messages.md): Telegram, SMS,
 * copy the link, or print. The link is fetched when the receipt opens, so a tap opens the app at
 * once (no pop-up blocking); nothing is sent by VirtualBiz.
 */
export function ShareReceipt({
  number,
  businessId,
  shopName,
  phone,
  btn,
}: {
  number: string;
  businessId: string;
  shopName: string;
  /** The customer's phone, for SMS. */
  phone?: string;
  /** Button class of the workspace. */
  btn: string;
}) {
  const t = useTranslations('receipt.share');
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  const { data, error } = useQuery({
    queryKey: ['receipt-link', businessId, number],
    queryFn: () =>
      api.post<{ token: string; path: string }>(
        `/sales/${encodeURIComponent(number)}/share`,
        {},
        { businessId },
      ),
    enabled: !!number,
    staleTime: Infinity,
  });
  const url =
    data && typeof window !== 'undefined' ? `${window.location.origin}/${locale}${data.path}` : '';
  const text = t('text', { shop: shopName, no: number });
  const off = !url;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
      <a
        className={btn}
        aria-disabled={off}
        style={off ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
        href={
          off
            ? undefined
            : `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
        }
        target="_blank"
        rel="noreferrer"
      >
        {t('telegram')}
      </a>
      <a
        className={btn}
        aria-disabled={off}
        style={off ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
        href={off ? undefined : `sms:${phone ?? ''}?&body=${encodeURIComponent(`${text} ${url}`)}`}
      >
        {t('sms')}
      </a>
      <button
        type="button"
        className={btn}
        disabled={off}
        onClick={() => void navigator.clipboard?.writeText(url).then(() => setCopied(true))}
      >
        {copied ? t('copied') : t('copy')}
      </button>
      <a
        className={btn}
        aria-disabled={off}
        style={off ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
        href={off ? undefined : `${url}?print=1`}
        target="_blank"
        rel="noreferrer"
      >
        {t('print')}
      </a>
      {error && (
        <span
          style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--danger, #c00)' }}
          role="alert"
        >
          {t('failed')}
        </span>
      )}
    </div>
  );
}
