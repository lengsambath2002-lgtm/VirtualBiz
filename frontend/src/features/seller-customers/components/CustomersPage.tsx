'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useMyRole } from '@/features/account-switcher';
import { CustomerList, EditCustomerDialog } from '@/features/business-customers';
import { copyText } from '@/features/seller-orders';
import {
  CloseButton,
  custStats,
  cx,
  Drawer,
  initials,
  lastAddressLine,
  s,
  useDb,
  useFmt,
  useSellerStore,
  useUi,
} from '@/features/seller-shared';
import { formatPhone } from '@/lib/utils/phone';

/** The shop's customers: every one, a page at a time, with lifetime orders and spend. */
export function CustomersPage() {
  const t = useTranslations('seller.customers');
  const db = useDb();
  const role = useMyRole(db.shop.id);
  return (
    <CustomerList
      businessId={db.shop.id}
      type="PRODUCT"
      canManage={role === 'OWNER' || role === 'MANAGER'}
      title={t('title')}
      sub={(n) => t('sub', { n })}
      onOpen={(r) => useUi.getState().open({ kind: 'customer', id: r.userId ?? r.id })}
      onSaved={(c) => {
        const st = useSellerStore.getState();
        if (c) st.putCustomer(c);
        else void st.resyncExtras();
      }}
    />
  );
}

export function CustomerDrawer({ id }: { id: string }) {
  const t = useTranslations('seller.customers');
  const tc = useTranslations('seller.common');
  const db = useDb();
  const f = useFmt();
  const [editing, setEditing] = useState(false);
  const c = db.customers.find((x) => x.id === id);
  if (!c) return null;
  const st = custStats(db.orders, id);
  const os = db.orders.filter((o) => o.customerId === id).slice(0, 10);
  const phone = formatPhone(c.phone);
  const ui = useUi.getState();
  return (
    <Drawer label={c.name}>
      <div className={s.drH}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className={s.av} style={{ width: 48, height: 48 }}>
            {initials(c.name)}
          </span>
          <div>
            <h2>{c.name}</h2>
            <div className={cx(s.meta, s.num)}>
              {phone} · {c.district}
            </div>
          </div>
        </div>
        <CloseButton />
      </div>
      <div className={s.drB}>
        <div className={s.g3} style={{ textAlign: 'center' }}>
          {(
            [
              [t('stat.orders'), st.n],
              [t('stat.spent'), f.money0(st.spent)],
              [t('stat.avg'), st.n ? f.money0(st.spent / st.n) : '–'],
            ] as const
          ).map(([l, v]) => (
            <div key={l} className={s.card} style={{ padding: 10, gap: 0 }}>
              <b className={s.num} style={{ fontSize: 18 }}>
                {v}
              </b>
              <span className={cx(s.tiny, s.muted)}>{l}</span>
            </div>
          ))}
        </div>
        {(c.email || c.note) && (
          <div className={s.small} style={{ display: 'grid', gap: 4 }}>
            {c.email && <span>{c.email}</span>}
            {c.note && (
              <span>
                <b style={{ fontWeight: 500 }}>{t('note')}</b> {c.note}
              </span>
            )}
          </div>
        )}
        <div className={s.small}>
          <b style={{ fontWeight: 500 }}>{t('defaultAddress')}</b>
          <br />
          {[lastAddressLine(db.orders, c.id), c.district, t('phnomPenh')]
            .filter(Boolean)
            .join(', ')}
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          <div className={s.secT}>{t('orders')}</div>
          {!os.length && <span className={cx(s.small, s.muted)}>{t('noOrders')}</span>}
          {os.map((o) => (
            <button
              key={o.id}
              type="button"
              className={s.row}
              style={{ padding: '8px 0' }}
              onClick={() => {
                ui.close(true);
                ui.open({ kind: 'order', id: o.id });
              }}
            >
              <span className={cx(s.num, s.small)}>{o.number}</span>
              <span className={cx(s.small, s.ellipsis)} style={{ minWidth: 0 }}>
                {o.lines.map((l) => l.title).join(', ')}
                <span className={cx(s.tiny, s.muted, s.block)}>{f.fmtDT(o.createdAt)}</span>
              </span>
              <span className={cx(s.num, s.small)}>{f.money(o.total)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={s.drF}>
        <div className={s.drFRow}>
          <button
            type="button"
            className={cx(s.btn, s.btnGhost)}
            onClick={() => void copyText(phone, ui.showToast, tc('copied', { v: phone }))}
          >
            {t('copyPhone')}
          </button>
          {c.clientId && (
            <button
              type="button"
              className={cx(s.btn, s.btnPrimary)}
              onClick={() => setEditing(true)}
            >
              {t('edit')}
            </button>
          )}
        </div>
      </div>
      {editing && c.clientId && (
        <EditCustomerDialog
          businessId={db.shop.id}
          customer={{ ...c, clientId: c.clientId }}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            useSellerStore.getState().putCustomer(saved);
            ui.showToast(t('saved', { name: saved.name }));
          }}
        />
      )}
    </Drawer>
  );
}
