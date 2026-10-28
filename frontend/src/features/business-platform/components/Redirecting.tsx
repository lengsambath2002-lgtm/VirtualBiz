'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { ErrorView, feedbackButton, StatusView } from '@/components/feedback';
import { isApiError } from '@/lib/api';
import { Link } from '@/lib/i18n/navigation';

import type { PlatformIntent } from '../types';
import { goToPlatform } from '../util/start';
import { PlatformMark } from './PlatformMark';
import s from './platform.module.css';

/** Starts a platform sign-in for this intent as soon as the page opens, and says so meanwhile. */
export function Redirecting({
  input,
}: {
  input: { intent: PlatformIntent; businessId?: string; orgId?: string };
}) {
  const t = useTranslations('platform');
  const [error, setError] = useState<unknown>(null);
  const started = useRef(false);
  const { intent, businessId, orgId } = input;

  const start = () => {
    setError(null);
    goToPlatform({
      intent,
      ...(businessId ? { businessId } : {}),
      ...(orgId ? { orgId } : {}),
    }).catch(setError);
  };

  useEffect(() => {
    // Once, even when React runs effects twice in development.
    if (started.current) return;
    started.current = true;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isApiError(error, 'NOT_CONFIGURED'))
    return (
      <StatusView
        kind="error"
        title={t('callback.unavailableTitle')}
        body={t('callback.unavailableBody')}
        actions={
          <Link className={feedbackButton(true)} href="/sign-in">
            {t('callback.signIn')}
          </Link>
        }
      />
    );
  if (error) return <ErrorView error={error} retry={start} />;
  return (
    <div className={s.wrap}>
      <div className={s.card} role="status" aria-live="polite">
        <span className={s.mark}>
          <PlatformMark size={24} />
        </span>
        <h1>{t('redirect.title')}</h1>
        <p className={s.muted}>{t('redirect.body')}</p>
        <span className={s.spin} aria-hidden="true" />
      </div>
    </div>
  );
}
