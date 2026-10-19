'use client';

import { useTranslations } from 'next-intl';

import { adminApi, useAdminAction, useBalances, usePayouts } from '@/features/admin-shared/api';
import {
  Empty,
  PanelError,
  Loading,
  PageHead,
  Pager,
  Pill,
  Seg,
  VerificationPill,
} from '@/features/admin-shared/components/ui';
import { useListParams } from '@/features/admin-shared/hooks/useListParams';
import type { PayoutBalance } from '@/features/admin-shared/types';
import { useAdminFmt } from '@/features/admin-shared/util/format';
import { cx, s, useUi } from '@/features/seller-shared';
import { fallbackErrorKey, isApiError } from '@/lib/api';
import { Link } from '@/lib/i18n/navigation';

const KEYS = ['view'] as const;

/** Why a shop with money waiting cannot be paid yet; null when it can. */
function blocker(b: PayoutBalance): 'verify' | 'bakong' | 'nothing' | null {
  if (b.payable <= 0) return 'nothing';
  if (b.verification !== 'VERIFIED') return 'verify';
  if (!b.bakongId) return 'bakong';
  return null;
}

function Balances() {
  const t = useTranslations('admin.payouts');
  const ta = useTranslations('admin');
  const tc = useTranslations('common');
  const f = useAdminFmt();
  const { data, isPending, error, refetch } = useBalances();
  const run = useAdminAction((fn: () => Promise<unknown>) => fn());
  if (isPending && !data) return <Loading />;
  if (error && !data) return <PanelError error={error} retry={() => void refetch()} />;
  if (!data?.length) return <Empty title={t('emptyBalances')} sub={t('emptyBalancesSub')} />;
  const pay = async (b: PayoutBalance) => {
    const ui = useUi.getState();
    const v = await ui.confirm({
      title: t('payTitle', { name: b.name }),
      body: t('payBody', { amount: f.money(b.payable), bakong: b.bakongId ?? '' }),
      ok: t('pay', { amount: f.money(b.payable) }),
      fields: [
        { type: 'input', key: 'reference', label: t('reference'), placeholder: 'ABA-…' },
        { type: 'input', key: 'note', label: ta('common.note') },
      ],
    });
    if (!v) return;
    try {
      await run.mutateAsync(() =>
        adminApi.pay(
          b.businessId,
          String(v.reference ?? '').trim(),
          String(v.note ?? '').trim() || undefined,
        ),
      );
      ui.showToast(t('paid', { name: b.name }));
    } catch (e) {
      const code = isApiError(e) ? e.code : '';
      ui.showToast(
        [
          'VALIDATION_FAILED',
          'VERIFICATION_REQUIRED',
          'PAYOUT_ACCOUNT_MISSING',
          'NOTHING_TO_PAY',
        ].includes(code)
          ? code === 'VALIDATION_FAILED'
            ? t('referenceNeeded')
            : ta(`errors.${code}` as 'errors.NOTHING_TO_PAY')
          : tc(fallbackErrorKey(e)),
      );
    }
  };
  return (
    <div className={s.tblWrap}>
      <table>
        <thead>
          <tr>
            <th>{t('col.shop')}</th>
            <th>{t('col.bakong')}</th>
            <th className={s.r}>{t('col.released')}</th>
            <th className={s.r}>{t('col.commission')}</th>
            <th className={s.r}>{t('col.takenBack')}</th>
            <th className={s.r}>{t('col.payable')}</th>
            <th className={s.r}>{t('col.onHold')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data.map((b) => {
            const why = blocker(b);
            return (
              <tr key={b.businessId}>
                <td>
                  <Link href={`/admin/shops/${b.businessId}`}>{b.name}</Link>
                  <span className={cx(s.tiny, s.muted, s.block)}>
                    {t('payments', { n: b.payments })}
                    {b.lastPayoutAt ? ` · ${t('last', { date: f.date(b.lastPayoutAt) })}` : ''}
                  </span>
                </td>
                <td>
                  {b.bakongId ? (
                    <span className={s.num}>{b.bakongId}</span>
                  ) : (
                    <Pill tone="warn">{t('noBakong')}</Pill>
                  )}
                  {b.verification !== 'VERIFIED' && (
                    <span className={s.block}>
                      <VerificationPill v={b.verification} />
                    </span>
                  )}
                </td>
                <td className={cx(s.r, s.num)}>{f.money(b.released)}</td>
                <td className={cx(s.r, s.num)}>
                  {b.commission > 0 ? `−${f.money(b.commission)}` : '—'}
                </td>
                <td className={cx(s.r, s.num)}>
                  {b.takenBack > 0 ? `−${f.money(b.takenBack)}` : '—'}
                </td>
                <td className={cx(s.r, s.num)}>
                  <strong>{f.money(b.payable)}</strong>
                </td>
                <td className={cx(s.r, s.num, s.muted)}>{f.money(b.onHold)}</td>
                <td className={s.r}>
                  {why === null ? (
                    <button
                      type="button"
                      className={cx(s.btn, s.btnPrimary, s.btnSm)}
                      onClick={() => void pay(b)}
                    >
                      {t('payNow')}
                    </button>
                  ) : why !== 'nothing' ? (
                    <span className={cx(s.tiny, s.muted)}>{t(`blocked.${why}`)}</span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function History() {
  const t = useTranslations('admin.payouts');
  const f = useAdminFmt();
  const { page, set } = useListParams(KEYS);
  const { data, isPending, error, refetch } = usePayouts({ page, size: 20 });
  if (isPending && !data) return <Loading />;
  if (error && !data) return <PanelError error={error} retry={() => void refetch()} />;
  if (!data?.items.length) return <Empty title={t('emptyHistory')} />;
  return (
    <>
      <div className={s.tblWrap}>
        <table>
          <thead>
            <tr>
              <th>{t('col.date')}</th>
              <th>{t('col.shop')}</th>
              <th>{t('col.reference')}</th>
              <th className={s.r}>{t('col.gross')}</th>
              <th className={s.r}>{t('col.commission')}</th>
              <th className={s.r}>{t('col.amount')}</th>
              <th>{t('col.by')}</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((p) => (
              <tr key={p.id}>
                <td className={s.num}>{f.dateTime(p.paidAt)}</td>
                <td>
                  <Link href={`/admin/shops/${p.businessId}`}>{p.shopName}</Link>
                  <span className={cx(s.tiny, s.muted, s.block, s.num)}>{p.bakongId}</span>
                </td>
                <td>
                  <span className={s.codeTag}>{p.reference}</span>
                  {p.note && <span className={cx(s.tiny, s.muted, s.block)}>{p.note}</span>}
                </td>
                <td className={cx(s.r, s.num)}>{f.money(p.gross)}</td>
                <td className={cx(s.r, s.num)}>−{f.money(p.commission)}</td>
                <td className={cx(s.r, s.num)}>
                  <strong>{f.money(p.amount)}</strong>
                  <span className={cx(s.tiny, s.muted, s.block)}>
                    {t('payments', { n: p.payments })}
                  </span>
                </td>
                <td>{p.paidByName ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} size={data.size} total={data.total} onPage={(p) => set({ page: p })} />
    </>
  );
}

/** `/admin/payouts`: what VirtualBiz owes each shop, and the transfers made. */
export function PayoutsPage() {
  const t = useTranslations('admin.payouts');
  const f = useAdminFmt();
  const { values: v, set } = useListParams(KEYS);
  const { data } = useBalances();
  const due = (data ?? []).reduce((n, b) => n + Math.max(0, b.payable), 0);
  const hold = (data ?? []).reduce((n, b) => n + b.onHold, 0);
  return (
    <>
      <PageHead title={t('title')} sub={t('sub')} />
      <div
        className={s.kpis}
        style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginBottom: 16 }}
      >
        <div className={s.kpi}>
          <span className={s.kpiL}>{t('due')}</span>
          <span className={s.kpiV}>{f.money(due)}</span>
          <span className={s.kpiS}>{f.khr(due)}</span>
        </div>
        <div className={s.kpi}>
          <span className={s.kpiL}>{t('onHold')}</span>
          <span className={s.kpiV}>{f.money(hold)}</span>
          <span className={s.kpiS}>{t('onHoldHint')}</span>
        </div>
      </div>
      <Seg
        label={t('viewLabel')}
        value={v.view}
        onChange={(view) => set({ view })}
        options={[
          { value: '', label: t('view.balances') },
          { value: 'history', label: t('view.history') },
        ]}
      />
      <section className={s.panel} style={{ marginTop: 12 }}>
        {v.view === 'history' ? <History /> : <Balances />}
      </section>
    </>
  );
}
