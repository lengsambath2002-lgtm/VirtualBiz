'use client';

import { useTranslations } from 'next-intl';

import { cx, s } from '@/features/seller-shared';
import { Link } from '@/lib/i18n/navigation';

import type { OrderRow } from '../types';
import { useAdminFmt } from '../util/format';
import { Empty, OrderStatusPill, PaymentPill, useRowLink } from './ui';

/** Orders across shops; a row opens the order. */
export function OrdersTable({
  rows,
  hideShop,
  hideCustomer,
}: {
  rows: OrderRow[];
  hideShop?: boolean;
  hideCustomer?: boolean;
}) {
  const t = useTranslations('admin.orders');
  const f = useAdminFmt();
  const row = useRowLink();
  if (!rows.length) return <Empty title={t('empty')} />;
  return (
    <div className={s.tblWrap}>
      <table>
        <thead>
          <tr>
            <th>{t('col.order')}</th>
            {!hideShop && <th>{t('col.shop')}</th>}
            {!hideCustomer && <th>{t('col.customer')}</th>}
            <th>{t('col.status')}</th>
            <th>{t('col.payment')}</th>
            <th className={s.r}>{t('col.total')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} {...row(`/admin/orders/${encodeURIComponent(o.number)}`)}>
              <td>
                <Link
                  href={`/admin/orders/${encodeURIComponent(o.number)}`}
                  className={cx(s.num, s.noUnderline)}
                  style={{ fontWeight: 600, color: 'inherit' }}
                >
                  {o.number}
                </Link>
                <span className={cx(s.tiny, s.muted, s.block)}>{f.dateTime(o.at)}</span>
              </td>
              {!hideShop && <td>{o.shopName}</td>}
              {!hideCustomer && <td>{o.customerName}</td>}
              <td>
                <OrderStatusPill status={o.status} />
              </td>
              <td>
                <PaymentPill method={o.paymentMethod} status={o.paymentStatus} />
              </td>
              <td className={cx(s.r, s.num)}>{f.money(o.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
