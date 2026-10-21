'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { ErrorView, NotFoundView } from '@/components/feedback';
import { api, isApiError } from '@/lib/api';
import type { PaymentMethod } from '@/lib/domain';
import { formatUsd, formatUsdAsKhr } from '@/lib/money';
import { vatIncluded } from '@/lib/shop';
import { photoBg } from '@/lib/utils/photo';

import r from './receipt.module.css';

interface Receipt {
  number: string;
  at: string;
  shop: {
    name: string;
    logoUrl?: string | null;
    phone: string;
    address: string;
    receiptHeader?: string | null;
    receiptFooter?: string | null;
    taxPct: number;
    taxId?: string | null;
  };
  lines: { title: string; variantName?: string | null; qty: number; unitPrice: number }[];
  subtotal: number;
  discount: number;
  tip: number;
  total: number;
  payments: { method: PaymentMethod; amount: number }[];
  refunded: number;
  customerName?: string | null;
  cashier?: string | null;
}

/** `/r/{token}`: a receipt a shop shared, printable (`?print=1` opens the print dialog). */
export function ReceiptPage({ token }: { token: string }) {
  const t = useTranslations('receipt');
  const locale = useLocale();
  const print = useSearchParams().get('print') === '1';
  const { data, error, refetch } = useQuery({
    queryKey: ['receipt', token],
    queryFn: () => api.get<Receipt>(`/receipts/${encodeURIComponent(token)}`, { auth: false }),
    retry: false,
  });
  useEffect(() => {
    if (data && print) setTimeout(() => window.print(), 300);
  }, [data, print]);

  if (error) {
    if (isApiError(error, 'SALE_NOT_FOUND'))
      return <NotFoundView title={t('notFoundTitle')} body={t('notFoundBody')} />;
    return <ErrorView error={error} retry={() => void refetch()} />;
  }
  if (!data) return <div className={r.wrap} aria-busy="true" />;
  const vat = vatIncluded(data.total - data.refunded, Number(data.shop.taxPct));
  const when = new Date(data.at).toLocaleString(locale === 'kh' ? 'km-KH' : 'en-GB', {
    timeZone: 'Asia/Phnom_Penh',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (
    <div className={r.wrap}>
      <article className={r.paper} aria-label={t('label', { no: data.number })}>
        <header className={r.head}>
          {data.shop.logoUrl && <span className={r.logo} style={photoBg(data.shop.logoUrl)} />}
          <h1>{data.shop.name}</h1>
          <p>{data.shop.address}</p>
          <p>{data.shop.phone}</p>
          {data.shop.receiptHeader && <p className={r.note}>{data.shop.receiptHeader}</p>}
        </header>
        <div className={r.meta}>
          <span>{t('number', { no: data.number })}</span>
          <span>{when}</span>
          {data.customerName && <span>{t('customer', { name: data.customerName })}</span>}
          {data.cashier && <span>{t('cashier', { name: data.cashier })}</span>}
        </div>
        <table className={r.lines}>
          <tbody>
            {data.lines.map((l, i) => (
              <tr key={i}>
                <td>
                  {l.qty} × {l.title}
                  {l.variantName ? ` (${l.variantName})` : ''}
                </td>
                <td>{formatUsd(l.qty * l.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className={r.sums}>
          {data.discount > 0 && (
            <>
              <dt>{t('discount')}</dt>
              <dd>−{formatUsd(data.discount)}</dd>
            </>
          )}
          {data.tip > 0 && (
            <>
              <dt>{t('tip')}</dt>
              <dd>{formatUsd(data.tip)}</dd>
            </>
          )}
          <dt className={r.total}>{t('total')}</dt>
          <dd className={r.total}>{formatUsd(data.total)}</dd>
          <dt>{t('riel')}</dt>
          <dd>{formatUsdAsKhr(data.total)}</dd>
          {data.payments.map((p, i) => (
            <span key={i} style={{ display: 'contents' }}>
              <dt>{t('paid', { m: t(`method.${p.method}` as 'method.CASH') })}</dt>
              <dd>{formatUsd(p.amount)}</dd>
            </span>
          ))}
          {data.refunded > 0 && (
            <>
              <dt>{t('refunded')}</dt>
              <dd>−{formatUsd(data.refunded)}</dd>
            </>
          )}
          {vat > 0 && (
            <>
              <dt>{t('vat', { pct: Number(data.shop.taxPct) })}</dt>
              <dd>{formatUsd(vat)}</dd>
            </>
          )}
        </dl>
        {data.shop.taxId && <p className={r.note}>{t('tin', { tin: data.shop.taxId })}</p>}
        {data.shop.receiptFooter && <p className={r.footer}>{data.shop.receiptFooter}</p>}
        <button type="button" className={r.print} onClick={() => window.print()}>
          {t('printButton')}
        </button>
      </article>
    </div>
  );
}
