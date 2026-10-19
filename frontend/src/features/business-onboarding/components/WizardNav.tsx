'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils/cn';

import type { WizardView } from '../hooks/useWizardStep';
import { OnbIcon } from './icons';
import s from './onboarding.module.css';

interface WizardNavProps {
  view: WizardView;
  shopName: string;
  onClose: () => void;
  onBack: () => void;
}

/** Glass nav bar: close (step 1 / done) or back, title, "Step n of 3" and the 3-segment progress. */
export function WizardNav({ view, shopName, onClose, onBack }: WizardNavProps) {
  const t = useTranslations('onboarding.nav');
  const done = view === 'done';
  const closes = done || view === 1;

  return (
    <header className={s.nav}>
      <div className={s.navIn}>
        <button
          type="button"
          className={s.ib}
          onClick={closes ? onClose : onBack}
          aria-label={closes ? t('close') : t('back')}
        >
          <OnbIcon name={closes ? 'x' : 'back'} size={18} />
        </button>
        <span className={s.navT}>{done ? shopName : t('title')}</span>
        <span className={cn(s.navR, s.tiny, s.muted, s.num)}>
          {done ? '' : t('stepOf', { step: view, total: 3 })}
        </span>
      </div>
      {!done && (
        <div className={s.stepsWrap}>
          <div className={s.steps3}>
            {[1, 2, 3].map((i) => (
              <i key={i} className={i <= view ? s.on : undefined} />
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
