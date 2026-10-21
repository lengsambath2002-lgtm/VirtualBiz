'use client';

import { SalesHistory } from './SalesHistory';
import { StaffAvatar } from '@/features/provider-shared/components/Bits';
import { PIcon } from '@/features/provider-shared/components/Icon';
import { k } from '@/features/provider-shared/cx';
import { useFmt } from '@/features/provider-shared/hooks/useFmt';
import { useData, useUi } from '@/features/provider-shared/store';
import { firstName } from '@/features/provider-shared/util/logic';
import { addDays, msOf, todayIso } from '@/features/provider-shared/util/time';
import type { PaymentMethod } from '@/lib/domain';

const PAYS: PaymentMethod[] = ['CASH', 'KHQR', 'CARD'];

/** Sales: ranges, KPIs, breakdowns, transactions (prototype `P.sales`). */
export function SalesPage() {
  const f = useFmt();
  const { t } = f;
  const d = useData();
  const ui = useUi();
  const today = todayIso();
  const from = msOf(ui.salesR === 1 ? today : addDays(today, -(ui.salesR - 1)));
  const payOf = (s: (typeof d.sales)[number]) => s.payments[0]?.method ?? 'CASH';
  const all = d.sales.filter((s) => Date.parse(s.at) >= from);
  const gross = all.reduce((x, s) => x + s.lines.reduce((y, i) => y + i.unitPrice * i.qty, 0), 0);
  const tips = all.reduce((x, s) => x + s.tip, 0);
  const disc = all.reduce((x, s) => x + s.discount, 0);
  const net = all.reduce((x, s) => x + s.total, 0);
  const byPay = PAYS.map(
    (p) => [p, all.filter((s) => payOf(s) === p).reduce((x, s) => x + s.total, 0)] as const,
  );
  const byStaff = d.staff.map(
    (st) =>
      [
        st,
        all.reduce(
          (x, s) =>
            x +
            s.lines.filter((i) => i.staffId === st.id).reduce((y, i) => y + i.unitPrice * i.qty, 0),
          0,
        ),
        all.filter((s) => s.lines.some((i) => i.staffId === st.id)).reduce((x, s) => x + s.tip, 0),
      ] as const,
  );

  return (
    <>
      <div className={k('ph-h')}>
        <div>
          <h1>{t('sales.title')}</h1>
          <p className={k('muted')}>{t('sales.sub')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div className={k('seg')}>
            {(
              [
                [1, 'today'],
                [7, 'd7'],
                [30, 'd30'],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                className={k(ui.salesR === v && 'on')}
                onClick={() => ui.set({ salesR: v })}
              >
                {t(`sales.${l}`)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={k('btn btn-primary btn-sm')}
            onClick={() => ui.open({ t: 'checkout' })}
          >
            <PIcon name="plus" size={16} />
            {t('sales.quickSale')}
          </button>
        </div>
      </div>
      <div className={k('kpis')}>
        <div className={k('kpi')}>
          <span className={k('l')}>{t('sales.collected')}</span>
          <span className={k('v')}>{f.money(net)}</span>
          <span className={k('s')}>{t('sales.salesKhr', { n: all.length, khr: f.khr(net) })}</span>
        </div>
        <div className={k('kpi')}>
          <span className={k('l')}>{t('sales.gross')}</span>
          <span className={k('v')}>{f.money(gross)}</span>
          <span className={k('s')}>{t('sales.beforeDisc')}</span>
        </div>
        <div className={k('kpi')}>
          <span className={k('l')}>{t('sales.tips')}</span>
          <span className={k('v')}>{f.money(tips)}</span>
          <span className={k('s')}>{t('sales.paidOut')}</span>
        </div>
        <div className={k('kpi')}>
          <span className={k('l')}>{t('sales.discounts')}</span>
          <span className={k('v')}>{f.money(disc)}</span>
          <span className={k('s')}>
            {t('sales.nSales', { n: all.filter((s) => s.discount).length })}
          </span>
        </div>
      </div>
      <div className={k('cols even')}>
        <section className={k('panel')}>
          <div className={k('panel-h')}>
            <h2>{t('sales.byPay')}</h2>
          </div>
          <div className={k('panel-b')} style={{ gap: 0 }}>
            {byPay.map(([p, v]) => (
              <div key={p} className={k('hbar')}>
                <span>{f.pay(p)}</span>
                <i>
                  <b
                    style={{ width: `${net ? (v / net) * 100 : 0}%`, background: 'var(--info)' }}
                  />
                </i>
                <span className={k('num')} style={{ textAlign: 'right' }}>
                  {f.money0(v)}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className={k('panel')}>
          <div className={k('panel-h')}>
            <h2>{t('sales.byStaff')}</h2>
          </div>
          <div className={k('panel-b')} style={{ gap: 0 }}>
            {!byStaff.length && <p className={k('small muted')}>{t('sales.noStaffSales')}</p>}
            {byStaff.map(([st, v, tip]) => (
              <div key={st.id} className={k('hbar')}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <StaffAvatar m={st} size={22} />
                  {firstName(st.name)}
                </span>
                <i>
                  <b style={{ width: `${gross ? (v / gross) * 100 : 0}%`, background: st.color }} />
                </i>
                <span
                  className={k('num')}
                  style={{ textAlign: 'right' }}
                  title={t('sales.tipsTitle', { amount: f.money(tip) })}
                >
                  {f.money0(v)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <SalesHistory />
    </>
  );
}
