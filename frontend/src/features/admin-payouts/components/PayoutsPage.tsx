'use client';

import { useTranslations } from 'next-intl';

import {
  chipsFor,
  DataTable,
  DateRangeFilter,
  ExportButton,
  FilterBar,
  Pagination,
  SegmentFilter,
  useListQuery,
  useRangeLabel,
  type Column,
  dataStyles,
} from '@/components/data';
import {
  adminApi,
  useAdminAction,
  useBalances,
  usePayouts,
  usePayoutSummary,
} from '@/features/admin-shared/api';
import { PageHead, Pill, VerificationPill } from '@/features/admin-shared/components/ui';
import type { Payout, PayoutBalance } from '@/features/admin-shared/types';
import { useAdminFmt } from '@/features/admin-shared/util/format';
import { cx, s, useUi } from '@/features/seller-shared';
import { fallbackErrorKey, isApiError } from '@/lib/api';
import { Link } from '@/lib/i18n/navigation';
import { usePlatformSettings } from '@/lib/platform';

const KEYS = ['view', 'q', 'due', 'from', 'to'] as const;
type List = ReturnType<typeof useListQuery<(typeof KEYS)[number]>>;

/** Why a shop with money waiting cannot be paid yet; null when it can. */
function blocker(b: PayoutBalance): 'verify' | 'bakong' | 'nothing' | null {
  if (b.payable <= 0) return 'nothing';
  if (b.verification !== 'VERIFIED') return 'verify';
  if (!b.bakongId) return 'bakong';
  return null;
}

function Balances({ list }: { list: List }) {
  const t = useTranslations('admin.payouts');
  const ta = useTranslations('admin');
  const tc = useTranslations('common');
  const tl = useTranslations('admin.lists');
  const f = useAdminFmt();
  const { data, isPending, isFetching, error, refetch } = useBalances(
    Object.fromEntries(new URLSearchParams(list.apiQuery())),
  );
  const run = useAdminAction((fn: () => Promise<unknown>) => fn());
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
  const columns: Column<PayoutBalance>[] = [
    {
      key: 'shop',
      header: t('col.shop'),
      sort: 'name',
      cell: (b) => (
        <>
          <Link href={`/admin/shops/${b.businessId}`}>{b.name}</Link>
          <span className={cx(s.tiny, s.muted, s.block)}>
            {t('payments', { n: b.payments })}
            {b.lastPayoutAt ? ` · ${t('last', { date: f.date(b.lastPayoutAt) })}` : ''}
          </span>
        </>
      ),
    },
    {
      key: 'bakong',
      header: t('col.bakong'),
      cell: (b) => (
        <>
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
        </>
      ),
    },
    {
      key: 'released',
      header: t('col.released'),
      align: 'right',
      hideNarrow: true,
      cell: (b) => <span className={s.num}>{f.money(b.released)}</span>,
    },
    {
      key: 'commission',
      header: t('col.commission'),
      align: 'right',
      hideNarrow: true,
      cell: (b) => (
        <span className={s.num}>{b.commission > 0 ? `−${f.money(b.commission)}` : '—'}</span>
      ),
    },
    {
      key: 'takenBack',
      header: t('col.takenBack'),
      align: 'right',
      hideNarrow: true,
      cell: (b) => (
        <span className={s.num}>{b.takenBack > 0 ? `−${f.money(b.takenBack)}` : '—'}</span>
      ),
    },
    {
      key: 'payable',
      header: t('col.payable'),
      sort: 'payable',
      sortFirst: 'desc',
      align: 'right',
      cell: (b) => <strong className={s.num}>{f.money(b.payable)}</strong>,
    },
    {
      key: 'onHold',
      header: t('col.onHold'),
      sort: 'onHold',
      sortFirst: 'desc',
      align: 'right',
      cell: (b) => <span className={cx(s.num, s.muted)}>{f.money(b.onHold)}</span>,
    },
    {
      key: 'act',
      header: <span className={dataStyles.srOnly}>{tl('actions')}</span>,
      align: 'right',
      cell: (b) => {
        const why = blocker(b);
        return why === null ? (
          <button
            type="button"
            className={cx(s.btn, s.btnPrimary, s.btnSm)}
            onClick={() => void pay(b)}
          >
            {t('payNow')}
          </button>
        ) : why !== 'nothing' ? (
          <span className={cx(s.tiny, s.muted)}>{t(`blocked.${why}`)}</span>
        ) : null;
      },
    },
  ];
  return (
    <>
      <DataTable
        label={t('view.balances')}
        columns={columns}
        rows={data?.items}
        rowKey={(b) => b.businessId}
        loading={isFetching && !isPending}
        error={error}
        retry={() => void refetch()}
        empty={{ title: t('emptyBalances'), body: t('emptyBalancesSub') }}
        sort={list.sort}
        onSort={list.toggleSort}
        minWidth={860}
      />
      {data && (
        <Pagination
          page={list.page}
          size={list.size}
          total={data.total}
          onPage={(page) => list.set({ page })}
          onSize={(size) => list.set({ size })}
        />
      )}
    </>
  );
}

function History({ list }: { list: List }) {
  const t = useTranslations('admin.payouts');
  const f = useAdminFmt();
  const { data, isPending, isFetching, error, refetch } = usePayouts(
    Object.fromEntries(new URLSearchParams(list.apiQuery())),
  );
  const columns: Column<Payout>[] = [
    {
      key: 'date',
      header: t('col.date'),
      sort: 'paid',
      sortFirst: 'desc',
      cell: (p) => <span className={s.num}>{f.dateTime(p.paidAt)}</span>,
    },
    {
      key: 'shop',
      header: t('col.shop'),
      cell: (p) => (
        <>
          <Link href={`/admin/shops/${p.businessId}`}>{p.shopName}</Link>
          <span className={cx(s.tiny, s.muted, s.block, s.num)}>{p.bakongId}</span>
        </>
      ),
    },
    {
      key: 'ref',
      header: t('col.reference'),
      cell: (p) => (
        <>
          <span className={s.codeTag}>{p.reference}</span>
          {p.note && <span className={cx(s.tiny, s.muted, s.block)}>{p.note}</span>}
        </>
      ),
    },
    {
      key: 'gross',
      header: t('col.gross'),
      align: 'right',
      hideNarrow: true,
      cell: (p) => <span className={s.num}>{f.money(p.gross)}</span>,
    },
    {
      key: 'commission',
      header: t('col.commission'),
      align: 'right',
      hideNarrow: true,
      cell: (p) => <span className={s.num}>−{f.money(p.commission)}</span>,
    },
    {
      key: 'amount',
      header: t('col.amount'),
      sort: 'amount',
      sortFirst: 'desc',
      align: 'right',
      cell: (p) => (
        <span className={s.num}>
          <strong>{f.money(p.amount)}</strong>
          <span className={cx(s.tiny, s.muted, s.block)}>{t('payments', { n: p.payments })}</span>
        </span>
      ),
    },
    { key: 'by', header: t('col.by'), hideNarrow: true, cell: (p) => p.paidByName ?? '—' },
  ];
  return (
    <>
      <DataTable
        label={t('view.history')}
        columns={columns}
        rows={data?.items}
        rowKey={(p) => p.id}
        loading={isFetching && !isPending}
        error={error}
        retry={() => void refetch()}
        empty={{ title: t('emptyHistory') }}
        sort={list.sort}
        onSort={list.toggleSort}
        minWidth={820}
      />
      {data && (
        <Pagination
          page={list.page}
          size={list.size}
          total={data.total}
          onPage={(page) => list.set({ page })}
          onSize={(size) => list.set({ size })}
        />
      )}
    </>
  );
}

/** `/admin/payouts`: what VirtualBiz owes each shop, and the transfers made. */
export function PayoutsPage() {
  const t = useTranslations('admin.payouts');
  const tl = useTranslations('admin.lists');
  const platform = usePlatformSettings();
  const f = useAdminFmt();
  const list = useListQuery(KEYS);
  const v = list.values;
  const history = v.view === 'history';
  const { data: sum } = usePayoutSummary();
  const rangeLabel = useRangeLabel(t('col.date'));
  return (
    <>
      <PageHead
        title={t('title')}
        sub={t('sub', { days: platform.payoutDelayDays })}
        actions={
          history ? (
            <ExportButton
              path={`/admin/payouts/export?${list.apiQuery()}`}
              className={cx(s.btn, s.btnGhost)}
            />
          ) : undefined
        }
      />
      <div
        className={s.kpis}
        style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginBottom: 16 }}
      >
        <div className={s.kpi}>
          <span className={s.kpiL}>{t('due')}</span>
          <span className={s.kpiV}>{f.money(sum?.payable ?? 0)}</span>
          <span className={s.kpiS}>
            {f.khr(sum?.payable ?? 0)} · {tl('shopsDue', { n: sum?.shopsDue ?? 0 })}
          </span>
        </div>
        <div className={s.kpi}>
          <span className={s.kpiL}>{t('onHold')}</span>
          <span className={s.kpiV}>{f.money(sum?.onHold ?? 0)}</span>
          <span className={s.kpiS}>{t('onHoldHint')}</span>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 12, marginBottom: 12 }}>
        <SegmentFilter
          label={t('viewLabel')}
          value={v.view}
          onChange={(view) => list.set({ view, q: '', due: '', from: '', to: '', sort: null })}
          options={[
            { value: '', label: t('view.balances') },
            { value: 'history', label: t('view.history') },
          ]}
        />
        <FilterBar
          q={v.q}
          onQ={(q) => list.set({ q })}
          placeholder={tl('payoutSearch')}
          active={chipsFor(
            list,
            { due: (x) => `${tl('dueLabel')}: ${tl(`due.${x}` as 'due.payable')}` },
            history ? rangeLabel : undefined,
          )}
          onClearAll={() => list.set({ q: '', due: '', from: '', to: '' })}
        >
          {history ? (
            <DateRangeFilter
              label={t('col.date')}
              from={v.from}
              to={v.to}
              onChange={(from, to) => list.set({ from, to })}
            />
          ) : (
            <SegmentFilter
              label={tl('dueLabel')}
              value={v.due}
              onChange={(due) => list.set({ due })}
              options={[
                { value: '', label: tl('due.all') },
                { value: 'payable', label: tl('due.payable') },
                { value: 'held', label: tl('due.held') },
                { value: 'noBakong', label: tl('due.noBakong') },
              ]}
            />
          )}
        </FilterBar>
      </div>
      <section className={s.panel}>
        {history ? <History list={list} /> : <Balances list={list} />}
      </section>
    </>
  );
}
