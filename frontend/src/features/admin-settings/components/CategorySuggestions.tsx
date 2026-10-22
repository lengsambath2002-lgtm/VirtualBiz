'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Pagination } from '@/components/data';

import { adminApi, useAdminAction, useCategoryRequests } from '@/features/admin-shared/api';
import { useAct } from '@/features/admin-shared/hooks/useAct';
import type { AdminCategory, CategoryRequest } from '@/features/admin-shared/types';
import { useAdminFmt } from '@/features/admin-shared/util/format';
import { cx, s, useUi } from '@/features/seller-shared';
import { fallbackErrorKey, isApiError } from '@/lib/api';
import { Link } from '@/lib/i18n/navigation';

const NEW = '__new';

/**
 * Shops' category suggestions waiting for a decision (docs/api/phase19-category-requests.md):
 * approve as a new category or an existing one (moving the shop), or decline with a reason the
 * shop reads. Super-admins decide; other staff see the queue.
 */
export function CategorySuggestions({
  categories,
  isSuper,
}: {
  categories: AdminCategory[];
  isSuper: boolean;
}) {
  const t = useTranslations('admin.settings.suggest');
  const tc = useTranslations('common');
  const locale = useLocale();
  const f = useAdminFmt();
  const act = useAct();
  const run = useAdminAction((fn: () => Promise<unknown>) => fn());
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const { data } = useCategoryRequests(page, size);
  // Deciding the last suggestion on a page goes back a page.
  useEffect(() => {
    if (data && !data.items.length && page > 0) setPage((p) => p - 1);
  }, [data, page]);
  if (!data?.items.length) return null;
  const label = (c: AdminCategory) => (locale === 'kh' ? c.nameKh : c.name);

  const approve = async (r: CategoryRequest) => {
    const ui = useUi.getState();
    const same = categories.filter((c) => c.businessType === r.businessType);
    const v = await ui.confirm({
      title: t('approveTitle', { name: r.name, shop: r.shopName ?? '' }),
      body: r.note ?? undefined,
      ok: t('approve'),
      fields: [
        {
          type: 'select',
          key: 'categoryId',
          label: t('as'),
          value: NEW,
          options: [
            { value: NEW, label: t('asNew') },
            ...same.map((c) => ({ value: c.id, label: t('asExisting', { name: label(c) }) })),
          ],
        },
        [
          { type: 'input', key: 'name', label: t('nameEn'), value: r.name },
          { type: 'input', key: 'nameKh', label: t('nameKh'), value: r.nameKh ?? '' },
        ],
        {
          type: 'switch',
          key: 'moveShop',
          label: t('move', { shop: r.shopName ?? '' }),
          value: true,
        },
      ],
    });
    if (!v) return;
    const existing = String(v.categoryId) !== NEW;
    try {
      await run.mutateAsync(() =>
        adminApi.approveCategoryRequest(r.id, {
          ...(existing ? { categoryId: String(v.categoryId) } : {}),
          ...(!existing && String(v.name ?? '').trim() ? { name: String(v.name).trim() } : {}),
          ...(!existing && String(v.nameKh ?? '').trim()
            ? { nameKh: String(v.nameKh).trim() }
            : {}),
          moveShop: Boolean(v.moveShop),
        }),
      );
      ui.showToast(t('approved', { name: r.name }));
    } catch (e) {
      ui.showToast(isApiError(e, 'CONFLICT') ? t('conflict') : tc(fallbackErrorKey(e)));
    }
  };
  const reject = (r: CategoryRequest) =>
    act({
      title: t('rejectTitle', { name: r.name }),
      body: t('rejectBody'),
      ok: t('reject'),
      danger: true,
      reason: 'required',
      reasonLabel: t('rejectReason'),
      done: t('rejected'),
      run: (why) => run.mutateAsync(() => adminApi.rejectCategoryRequest(r.id, why)),
    });

  return (
    <section className={s.panel} aria-labelledby="cat-suggest-h">
      <div className={s.panelH}>
        <div>
          <h2 id="cat-suggest-h">{t('title', { n: data.total })}</h2>
          <p className={cx(s.small, s.muted)}>{t('sub')}</p>
        </div>
      </div>
      <div className={s.tblWrap}>
        <table>
          <thead>
            <tr>
              <th>{t('col.name')}</th>
              <th>{t('col.shop')}</th>
              <th>{t('col.note')}</th>
              <th>{t('col.when')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.items.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong style={{ fontWeight: 550 }}>{r.name}</strong>
                  {r.nameKh && <span className={cx(s.tiny, s.muted, s.block)}>{r.nameKh}</span>}
                </td>
                <td>
                  <Link href={`/admin/shops/${r.businessId}`}>{r.shopName}</Link>
                  <span className={cx(s.tiny, s.muted, s.block)}>
                    {t(`type.${r.businessType}`)} · {r.requestedByName}
                  </span>
                </td>
                <td className={s.small} style={{ maxWidth: 280, whiteSpace: 'normal' }}>
                  {r.note ?? '—'}
                </td>
                <td className={cx(s.small, s.num)}>{f.date(r.createdAt)}</td>
                <td className={s.r} style={{ whiteSpace: 'nowrap' }}>
                  {isSuper ? (
                    <>
                      <button
                        type="button"
                        className={cx(s.btn, s.btnPrimary, s.btnSm)}
                        onClick={() => void approve(r)}
                      >
                        {t('approve')}
                      </button>{' '}
                      <button
                        type="button"
                        className={cx(s.btn, s.btnGhost, s.btnSm)}
                        onClick={() => void reject(r)}
                      >
                        {t('reject')}
                      </button>
                    </>
                  ) : (
                    <span className={cx(s.tiny, s.muted)}>{t('superOnly')}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        size={size}
        total={data.total}
        onPage={setPage}
        onSize={(n) => {
          setSize(n);
          setPage(0);
        }}
      />
    </section>
  );
}
