'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import s from './feedback.module.css';

/**
 * While a workspace (or the console) loads its data: a spinner and what's happening, and after a
 * few seconds a word that a slow start is the server waking up, so a wait never looks like a
 * blank, broken page.
 */
export function WorkspaceLoading() {
  const t = useTranslations('common.feedback');
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className={s.loadingScreen} role="status" aria-live="polite" aria-busy="true">
      <span className={s.spinner} aria-hidden />
      <strong>{t('opening')}</strong>
      {slow && <span className={s.loadingSlow}>{t('openingSlow')}</span>}
    </div>
  );
}
