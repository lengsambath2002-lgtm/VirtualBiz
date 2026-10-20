'use client';

import { useTranslations } from 'next-intl';
import { LoadFailed } from '@/components/feedback';

import { adminApi, useAdminAction, useOrder } from '@/features/admin-shared/api';
import { AuditList } from '@/features/admin-shared/components/AuditList';
import {
  KV,
  Loading,
  OrderStatusPill,
  PageHead,
  PaymentPill,
} from '@/features/admin-shared/components/ui';
import { useAct } from '@/features/admin-shared/hooks/useAct';
import { useAdminFmt } from '@/features/admin-shared/util/format';
import { useReasonText } from '@/features/seller-orders/hooks/useReasonText';
import { cx, s, useUi } from '@/features/seller-shared';
import { Link } from '@/lib/i18n/navigation';
import { formatPhone } from '@/lib/utils/phone';

const CANCELLABLE = ['NEW', 'ACCEPTED', 'PACKED'];
const REFUNDABLE = ['DELIVERED', 'PICKED_UP'];

/** `/admin/orders/[number]`: the full record and support's dispute tools. */
export function OrderPage({ number }: { number: string }) {
  const t = useTranslations('admin.order');
  const ta = useTranslations('admin');
  const f = useAdminFmt();
  const why = useReasonText();
  const { data: d, isPending, error, refetch } = useOrder(number);
  const act = useAct();
  const run = useAdminAction((fn: () => Promise<unknown>) => fn());
  if (error && !d)
    return (
      <LoadFailed
        error={error}
        retry={() => void refetch()}
        home="/admin/orders"
        homeLabel={ta('order.backList')}
        notFoundTitle={ta('order.missing')}
      />
    );
  if (isPending || !d) return <Loading />;
  const o = d.order;
  const go = (fn: () => Promise<unknown>) => run.mutateAsync(fn);

  const cancel = () =>
    act({
      title: t('cancelTitle', { no: o.number }),
      body:
        d.payment?.status === 'PAID'
          ? t('cancelBodyPaid', { amount: f.money(o.total) })
          : t('cancelBody'),
      ok: t('cancel'),
      danger: true,
      reason: 'required',
      done: t('cancelled'),
      run: (r) => go(() => adminApi.cancelOrder(o.number, r)),
    });
  const refund = async () => {
    const v = await useUi.getState().confirm({
      title: t('refundTitle', { no: o.number }),
      body: t('refundBody', { amount: f.money(o.total) }),
      ok: t('refund'),
      danger: true,
      fields: [
        { type: 'input', key: 'reason', label: ta('common.reason') },
        {
          type: 'switch',
          key: 'restock',
          label: t('restock'),
          hint: t('restockHint'),
          value: true,
        },
      ],
    });
    if (!v) return;
    const reason = String(v.reason ?? '').trim();
    if (reason.length < 3) return useUi.getState().showToast(ta('common.reasonNeeded'));
    try {
      await go(() => adminApi.refundOrder(o.number, reason, Boolean(v.restock)));
      useUi.getState().showToast(t('refunded'));
    } catch {
      useUi.getState().showToast(ta('errors.INVALID_STATUS_TRANSITION'));
    }
  };

  const a = d.address;
  return (
    <>
      <p className={cx(s.small, s.muted)} style={{ marginBottom: 8 }}>
        <Link href="/admin/orders">{t('back')}</Link>
      </p>
      <PageHead
        title={o.number}
        sub={`${f.dateTime(o.at)} · ${ta(`method.${o.method}`)}`}
        actions={
          <>
            <OrderStatusPill status={o.status} />
            {CANCELLABLE.includes(o.status) && (
              <button
                type="button"
                className={cx(s.btn, s.btnDanger)}
                onClick={() => void cancel()}
              >
                {t('cancel')}
              </button>
            )}
            {REFUNDABLE.includes(o.status) && (
              <button
                type="button"
                className={cx(s.btn, s.btnDanger)}
                onClick={() => void refund()}
              >
                {t('refund')}
              </button>
            )}
          </>
        }
      />
      {o.cancelReason && (
        <div className={s.warnbox} style={{ marginBottom: 16 }}>
          {t(o.status === 'RETURNED' ? 'returnedWhy' : 'cancelledWhy', {
            why: why(o.cancelReason),
          })}
        </div>
      )}
      <div className={s.cols}>
        <div style={{ display: 'grid', gap: 16 }}>
          <section className={s.panel}>
            <div className={s.panelH}>
              <h2>{t('items')}</h2>
            </div>
            <div className={s.tblWrap}>
              <table style={{ minWidth: 0 }}>
                <tbody>
                  {d.lines.map((l, i) => (
                    <tr key={i}>
                      <td>
                        {l.title}
                        {l.variantName && (
                          <span className={cx(s.tiny, s.muted, s.block)}>{l.variantName}</span>
                        )}
                      </td>
                      <td className={cx(s.r, s.num)}>
                        {l.qty} × {f.money(l.unitPrice)}
                      </td>
                      <td className={cx(s.r, s.num)}>{f.money(l.qty * l.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={s.panelB}>
              <KV
                rows={[
                  [t('subtotal'), f.money(d.subtotal)],
                  ...(d.discount > 0
                    ? ([[t('discount'), `−${f.money(d.discount)}`]] as [string, string][])
                    : []),
                  ...(d.promoDiscount > 0
                    ? ([
                        [t('promo', { code: d.promoCode ?? '' }), `−${f.money(d.promoDiscount)}`],
                      ] as [string, string][])
                    : []),
                  [t('delivery'), f.money(d.deliveryFee)],
                  [t('total'), <strong key="t">{f.money(o.total)}</strong>],
                ]}
              />
            </div>
          </section>
          <section className={s.panel}>
            <div className={s.panelH}>
              <h2>{t('timeline')}</h2>
            </div>
            <ol
              style={{
                listStyle: 'none',
                margin: 0,
                padding: '4px 16px 16px',
                display: 'grid',
                gap: 10,
              }}
            >
              {d.events.map((e, i) => (
                <li key={i} style={{ display: 'grid', gap: 2 }}>
                  <span>
                    <OrderStatusPill status={e.status} />{' '}
                    <span className={cx(s.small, s.muted)}>
                      {f.dateTime(e.at)}
                      {e.byName ? ` · ${e.byName}` : ''}
                    </span>
                  </span>
                  {e.note && <span className={s.small}>{e.note}</span>}
                </li>
              ))}
            </ol>
          </section>
          <section className={s.panel}>
            <div className={s.panelH}>
              <h2>{t('history')}</h2>
            </div>
            <AuditList rows={d.history} />
          </section>
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          <section className={s.panel}>
            <div className={s.panelH}>
              <h2>{t('payment')}</h2>
              <PaymentPill method={d.payment?.method} status={d.payment?.status} />
            </div>
            <div className={s.panelB}>
              {d.payment ? (
                <KV
                  rows={[
                    [t('amount'), f.money(d.payment.amount)],
                    [t('channel'), ta(`channel.${d.payment.channel}` as 'channel.ONLINE')],
                    [t('commission'), f.money(d.payment.commission)],
                    [t('paidAt'), f.dateTime(d.payment.paidAt)],
                    ...(d.payment.refundedAt
                      ? ([[t('refundedAt'), f.dateTime(d.payment.refundedAt)]] as [
                          string,
                          string,
                        ][])
                      : []),
                    [t('payout'), d.payment.payoutId ? t('paidOut') : t('notPaidOut')],
                  ]}
                />
              ) : (
                <span className={s.muted}>—</span>
              )}
            </div>
          </section>
          <section className={s.panel}>
            <div className={s.panelH}>
              <h2>{t('people')}</h2>
            </div>
            <div className={s.panelB}>
              <KV
                rows={[
                  [
                    t('customer'),
                    o.customerId ? (
                      <Link key="c" href={`/admin/users/${o.customerId}`}>
                        {o.customerName}
                      </Link>
                    ) : (
                      // A manual order the shop entered: no VirtualBiz account behind it.
                      `${o.customerName} · ${t('noAccount')}`
                    ),
                  ],
                  [
                    t('contact'),
                    [d.customerEmail, d.customerPhone && formatPhone(d.customerPhone)]
                      .filter(Boolean)
                      .join(' · ') || '—',
                  ],
                  [
                    t('shop'),
                    <Link key="s" href={`/admin/shops/${o.businessId}`}>
                      {o.shopName}
                    </Link>,
                  ],
                  [t('shopPhone'), d.shopPhone ? formatPhone(d.shopPhone) : '—'],
                  ...(a
                    ? ([
                        [
                          t('address'),
                          [a.name, a.phone && formatPhone(a.phone), a.line, a.district, a.note]
                            .filter(Boolean)
                            .join(', '),
                        ],
                      ] as [string, string][])
                    : []),
                  ...(d.note ? ([[t('note'), d.note]] as [string, string][]) : []),
                ]}
              />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
