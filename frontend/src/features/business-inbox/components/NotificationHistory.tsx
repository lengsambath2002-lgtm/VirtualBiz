'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Pagination, SegmentFilter, useListQuery } from '@/components/data';
import { EmptyView, ErrorView } from '@/components/feedback';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils/cn';

import n$ from './inbox.module.css';

/** A shop inbox entry as the API returns it. */
export interface InboxEntry {
  id: string;
  kind: string;
  params: Record<string, string>;
  route: string;
  unread: boolean;
  at: string;
}

interface Page {
  items: InboxEntry[];
  total: number;
}

/**
 * The shop's whole inbox (docs/api/phase17-more-lists.md), newest first, a page at a time, with
 * an unread filter and "mark all read". Each workspace words the entries and opens their target.
 */
export function NotificationHistory({
  businessId,
  text,
  onOpen,
  onRead,
}: {
  businessId: string;
  text: (n: InboxEntry) => string;
  onOpen: (n: InboxEntry) => void;
  /** After a read: the workspace updates its bell. */
  onRead?: (id?: string) => void;
}) {
  const t = useTranslations('inbox');
  const qc = useQueryClient();
  const list = useListQuery(['unread'] as const, { size: 20 });
  const unread = list.values.unread === 'true';
  const query = new URLSearchParams({
    unread: String(unread),
    page: String(list.page),
    size: String(list.size),
  }).toString();
  const { data, error, refetch } = useQuery({
    queryKey: ['inbox', businessId, query],
    queryFn: () => api.get<Page>(`/notifications/history?${query}`, { businessId }),
    placeholderData: keepPreviousData,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['inbox', businessId] });
  const markAll = async () => {
    await api.post('/notifications/read-all', undefined, { businessId });
    onRead?.();
    refresh();
  };
  const open = (n: InboxEntry) => {
    if (n.unread) {
      void api.post(`/notifications/${n.id}/read`, undefined, { businessId }).then(refresh);
      onRead?.(n.id);
    }
    onOpen(n);
  };
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <>
      <div className={n$.head}>
        <div>
          <h1>{t('title')}</h1>
          <p>{t('sub')}</p>
        </div>
        <button type="button" className={n$.ghost} onClick={() => void markAll()}>
          {t('markAll')}
        </button>
      </div>
      <div style={{ marginBottom: 12 }}>
        <SegmentFilter
          label={t('show')}
          value={list.values.unread}
          onChange={(v) => list.set({ unread: v })}
          options={[
            { value: '', label: t('all') },
            { value: 'true', label: t('unread') },
          ]}
        />
      </div>
      <section className={n$.panel}>
        {error && !data ? (
          <ErrorView error={error} retry={() => void refetch()} size="panel" />
        ) : !data ? (
          <div className={n$.loading} aria-busy="true" />
        ) : !data.items.length ? (
          <EmptyView
            title={unread ? t('noUnread') : t('empty')}
            body={unread ? t('noUnreadBody') : t('emptyBody')}
            size="panel"
          />
        ) : (
          <ul className={n$.list}>
            {data.items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={cn(n$.row, n.unread && n$.unread)}
                  onClick={() => open(n)}
                >
                  <span className={n$.dot} aria-hidden />
                  <span className={n$.text}>
                    {text(n)}
                    <span className={n$.at}>{fmt(n.at)}</span>
                  </span>
                  {n.unread && <span className={n$.srOnly}>{t('unread')}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {data && (
          <Pagination
            page={list.page}
            size={list.size}
            total={data.total}
            onPage={(page) => list.set({ page })}
            onSize={(size) => list.set({ size })}
          />
        )}
      </section>
    </>
  );
}
