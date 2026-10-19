'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { ApiError, isApiError, NETWORK_ERROR } from '@/lib/api';
import { Link } from '@/lib/i18n/navigation';

import { feedbackButton, StatusView } from './StatusView';

/** Page not found (404): what to do next. `home` is the surface's start page. */
export function NotFoundView({
  size = 'page',
  home = '/home',
  homeLabel,
  title,
  body,
}: {
  size?: 'page' | 'panel';
  home?: string;
  homeLabel?: string;
  title?: string;
  body?: string;
}) {
  const t = useTranslations('common.feedback');
  return (
    <StatusView
      kind="notFound"
      size={size}
      code={size === 'page' ? '404' : undefined}
      title={title ?? t('notFoundTitle')}
      body={body ?? t('notFoundBody')}
      actions={
        <>
          <Link className={feedbackButton(true)} href={home}>
            {homeLabel ?? t('home')}
          </Link>
          {size === 'page' && (
            <button type="button" className={feedbackButton()} onClick={() => history.back()}>
              {t('back')}
            </button>
          )}
        </>
      }
    />
  );
}

/**
 * Something failed: a crashed page (error boundary) or a load that the API refused. Offline gets
 * its own wording; `retry` offers "Try again"; `reference` is shown for support.
 */
export function ErrorView({
  error,
  retry,
  size = 'page',
  home = '/home',
  homeLabel,
  reference,
}: {
  error?: unknown;
  retry?: () => void;
  size?: 'page' | 'panel';
  home?: string | null;
  homeLabel?: string;
  reference?: string;
}) {
  const t = useTranslations('common.feedback');
  const offline =
    (error instanceof ApiError && error.code === NETWORK_ERROR) ||
    (typeof navigator !== 'undefined' && navigator.onLine === false);
  const ref = reference ?? (error instanceof ApiError ? error.requestId : undefined);
  return (
    <StatusView
      kind={offline ? 'offline' : 'error'}
      size={size}
      title={offline ? t('offlineTitle') : t('errorTitle')}
      body={offline ? t('offlineBody') : t('errorBody')}
      actions={
        <>
          {retry && (
            <button type="button" className={feedbackButton(true)} onClick={retry}>
              {t('retry')}
            </button>
          )}
          {home && (
            <Link className={feedbackButton(!retry)} href={home}>
              {homeLabel ?? t('home')}
            </Link>
          )}
        </>
      }
      footnote={ref ? t('reference', { ref }) : undefined}
    />
  );
}

/**
 * A data load that failed: "not found" when the API says the thing doesn't exist (404 or a
 * `*_NOT_FOUND` code), otherwise the error view with a retry.
 */
export function LoadFailed({
  error,
  retry,
  size = 'page',
  home,
  homeLabel,
  notFoundTitle,
}: {
  error: unknown;
  retry?: () => void;
  size?: 'page' | 'panel';
  home?: string;
  homeLabel?: string;
  notFoundTitle?: string;
}) {
  if (isNotFound(error))
    return <NotFoundView size={size} home={home} homeLabel={homeLabel} title={notFoundTitle} />;
  return (
    <ErrorView error={error} retry={retry} size={size} home={home ?? null} homeLabel={homeLabel} />
  );
}

export const isNotFound = (e: unknown) =>
  isApiError(e) && (e.status === 404 || e.code.endsWith('_NOT_FOUND') || e.code === 'NOT_FOUND');

/** An empty list or panel: what it is, why it's empty, and the next step. */
export function EmptyView({
  title,
  body,
  action,
  size = 'panel',
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  size?: 'page' | 'panel';
}) {
  return <StatusView kind="empty" size={size} title={title} body={body} actions={action} />;
}

/** An empty table: one full-width row under the headers. */
export function EmptyRow({
  cols,
  title,
  body,
  action,
}: {
  cols: number;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={cols} style={{ padding: 0, borderBottom: 0 }}>
        <EmptyView title={title} body={body} action={action} />
      </td>
    </tr>
  );
}
