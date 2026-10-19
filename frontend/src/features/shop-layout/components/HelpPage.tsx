'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import s from '@/features/shop-shared/shop.module.css';

export function HelpPage() {
  const t = useTranslations('shop.help');
  return (
    <div className={cn(s.empty, s.emptyTall, s.glassMat)}>
      <strong>{t('title')}</strong>
      <span>{t('body')}</span>
      <Link className={cn(s.btn, s.btnGhost, s.btnSm)} href="/home">
        {t('back')}
      </Link>
    </div>
  );
}
