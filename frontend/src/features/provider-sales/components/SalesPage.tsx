'use client';

import { StaffAvatar } from '@/features/provider-shared/components/Bits';
import { PIcon } from '@/features/provider-shared/components/Icon';
import { k } from '@/features/provider-shared/cx';
import { useFmt } from '@/features/provider-shared/hooks/useFmt';
import { useData, useUi } from '@/features/provider-shared/store';
import { firstName } from '@/features/provider-shared/util/logic';
import { addDays, fmtShortStamp, msOf, todayIso } from '@/features/provider-shared/util/time';
import type { PaymentMethod } from '@/lib/domain';

const PAYS: PaymentMethod[] = ['CASH', 'KHQR', 'CARD'];

/** Sales: ranges, KPIs, breakdowns, transactions (prototype `P.sales`). */
export function SalesPage() {
  const f = useFmt();
  const { t, locale } = f;
  const d = useData();
  const ui = useUi();
  const today = todayIso();
  const from = msOf(ui.salesR === 1 ? today : addDays(today, -(ui.salesR - 1)));
  const payOf = (s: (typeof d.sales)[number]) => s.payments[0]?.method ?? 'CASH';
  const all = d.sales.filter((s) => Date.parse(s.at) >= from);
  const list = all
    .filter((s) => ui.payF === 'all' || payOf(s) === ui.payF)
    .sort((a, b) => b.at.localeCompare(a.at));
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
      <section className={k('panel')}>
        <div className={k('panel-h')}>
          <h2>{t('sales.transactions')}</h2>
          <div className={k('chips')}>
            {(['all', ...PAYS] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={k('chip', ui.payF === p && 'on')}
                onClick={() => ui.set({ payF: p })}
              >
                {p === 'all' ? t('sales.all') : f.pay(p)}
              </button>
            ))}
          </div>
        </div>
        <div className={k('tbl-wrap')}>
          <table>
            <thead>
              <tr>
                <th>{t('sales.thDate')}</th>
                <th>{t('sales.thClient')}</th>
                <th>{t('sales.thItems')}</th>
                <th>{t('sales.thPayment')}</th>
                <th className={k('r')}>{t('sales.thTip')}</th>
                <th className={k('r')}>{t('sales.thTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {list.length ? (
                list.slice(0, 40).map((s) => {
                  const c = s.customerId ? d.clients.find((x) => x.id === s.customerId) : undefined;
                  const openIt = () => ui.open({ t: 'receipt', saleId: s.id });
                  return (
                    <tr
                      key={s.id}
                      className={k('clk')}
                      tabIndex={0}
                      onClick={openIt}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') openIt();
                      }}
                    >
                      <td className={k('num')}>{fmtShortStamp(s.at, locale)}</td>
                      <td>
                        {c ? c.name : <span className={k('muted')}>{t('sales.walkin')}</span>}
                      </td>
                      <td>{s.lines.map((i) => i.title).join(', ')}</td>
                      <td>
                        <span className={k('pill neutral')}>{f.pay(payOf(s))}</span>
                      </td>
                      <td className={k('r num')}>{s.tip ? f.money(s.tip) : '–'}</td>
                      <td className={k('r num')}>
                        <b>{f.money(s.total)}</b>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className={k('empty')}>
                      <strong>{t('sales.empty')}</strong>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            {list.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4}>
                    {list.length > 40
                      ? t('sales.footMore', { n: list.length })
                      : t('sales.foot', { n: list.length })}
                  </td>
                  <td className={k('r num')}>{f.money(list.reduce((x, s) => x + s.tip, 0))}</td>
                  <td className={k('r num')}>{f.money(list.reduce((x, s) => x + s.total, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </>
  );
}
