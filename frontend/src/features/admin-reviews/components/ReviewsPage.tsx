'use client';

import { useTranslations } from 'next-intl';

import { adminApi, useAdminAction, useReviews } from '@/features/admin-shared/api';
import {
  Empty,
  Loading,
  PanelError,
  PageHead,
  Pager,
  Pill,
  SearchBox,
  Seg,
} from '@/features/admin-shared/components/ui';
import { useAct } from '@/features/admin-shared/hooks/useAct';
import { useListParams } from '@/features/admin-shared/hooks/useListParams';
import type { ReviewRow } from '@/features/admin-shared/types';
import { useAdminFmt } from '@/features/admin-shared/util/format';
import { cx, s, Stars } from '@/features/seller-shared';
import { Link } from '@/lib/i18n/navigation';

const KEYS = ['q', 'status', 'stars', 'businessId'] as const;

/** `/admin/reviews`: moderation. Hiding takes a review out of public lists and ratings. */
export function ReviewsPage() {
  const t = useTranslations('admin.reviews');
  const ta = useTranslations('admin');
  const f = useAdminFmt();
  const { values: v, page, set } = useListParams(KEYS);
  const { data, isPending, error, refetch } = useReviews({ ...v, page, size: 20 });
  const act = useAct();
  const run = useAdminAction((fn: () => Promise<unknown>) => fn());

  const hide = (r: ReviewRow) =>
    act({
      title: t('hideTitle', { name: r.authorName }),
      body: t('hideBody'),
      ok: t('hide'),
      danger: true,
      reason: 'required',
      done: t('hidden'),
      run: (why) => run.mutateAsync(() => adminApi.hideReview(r.id, why)),
    });
  const restore = (r: ReviewRow) =>
    act({
      title: t('restoreTitle', { name: r.authorName }),
      ok: t('restore'),
      done: t('restored'),
      run: () => run.mutateAsync(() => adminApi.restoreReview(r.id)),
    });

  return (
    <>
      <PageHead title={t('title')} sub={data ? t('sub', { n: data.total }) : undefined} />
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <SearchBox
          value={v.q}
          onChange={(q) => set({ q })}
          placeholder={t('searchPh')}
          label={t('searchLabel')}
        />
        <Seg
          label={t('statusLabel')}
          value={v.status}
          onChange={(status) => set({ status })}
          options={[
            { value: '', label: ta('common.all') },
            { value: 'low', label: t('filter.low') },
            { value: 'visible', label: t('filter.visible') },
            { value: 'hidden', label: t('filter.hidden') },
          ]}
        />
        <select
          className={cx(s.btn, s.btnGhost, s.btnSm)}
          aria-label={t('starsLabel')}
          value={v.stars}
          onChange={(e) => set({ stars: e.target.value })}
        >
          <option value="">{t('anyStars')}</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {'★'.repeat(n)}
            </option>
          ))}
        </select>
      </div>
      <section className={s.panel}>
        {isPending && !data ? (
          <Loading />
        ) : error && !data ? (
          <PanelError error={error} retry={() => void refetch()} />
        ) : !data?.items.length ? (
          <Empty title={t('empty')} />
        ) : (
          <div style={{ display: 'grid' }}>
            {data.items.map((r) => (
              <article
                key={r.id}
                style={{
                  padding: 16,
                  borderBottom: '1px solid var(--line)',
                  display: 'grid',
                  gap: 6,
                  opacity: r.hiddenAt ? 0.7 : 1,
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <Stars n={r.stars} />
                  <strong>{r.authorName}</strong>
                  {r.verified && <Pill tone="ok">{t('verified')}</Pill>}
                  {r.hiddenAt && <Pill tone="bad">{t('hiddenPill')}</Pill>}
                  <span className={cx(s.small, s.muted)}>
                    {f.date(r.at)} · <Link href={`/admin/shops/${r.businessId}`}>{r.shopName}</Link>
                    {r.itemName ? ` · ${r.itemName}` : ''}
                  </span>
                  <span style={{ flex: 1 }} />
                  {r.hiddenAt ? (
                    <button
                      type="button"
                      className={cx(s.btn, s.btnGhost, s.btnSm)}
                      onClick={() => void restore(r)}
                    >
                      {t('restore')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={cx(s.btn, s.btnGhost, s.btnSm)}
                      onClick={() => void hide(r)}
                    >
                      {t('hide')}
                    </button>
                  )}
                </div>
                {r.text && <p style={{ margin: 0 }}>{r.text}</p>}
                {r.tags.length > 0 && (
                  <span className={cx(s.tiny, s.muted)}>{r.tags.join(' · ')}</span>
                )}
                {r.reply && (
                  <p className={cx(s.small, s.muted)} style={{ margin: 0 }}>
                    {t('reply', { text: r.reply })}
                  </p>
                )}
                {r.hiddenAt && (
                  <span className={cx(s.small, s.dangerText)}>
                    {t('hiddenBecause', { reason: r.hiddenReason ?? '', date: f.date(r.hiddenAt) })}
                  </span>
                )}
              </article>
            ))}
          </div>
        )}
        {data && (
          <Pager page={page} size={data.size} total={data.total} onPage={(p) => set({ page: p })} />
        )}
      </section>
    </>
  );
}
