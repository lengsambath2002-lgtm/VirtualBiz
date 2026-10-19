'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils/cn';

import { useOnboardingCategories } from '../queries';
import type { BusinessDraft, DraftBusinessType, DraftProblem } from '../types';
import { Field } from './Field';
import { OnbIcon } from './icons';
import s from './onboarding.module.css';

interface StepProps {
  draft: BusinessDraft;
  errors: ReadonlySet<DraftProblem>;
  onType: (type: DraftBusinessType) => void;
  onName: (name: string) => void;
  onCategory: (id: string) => void;
}

const TYPES = [
  { value: 'product', icon: 'box', tint: 't2' },
  { value: 'service', icon: 'cal', tint: 't3' },
] as const;

/** Step 1: product or service, shop name, category chips. */
export function StepBusiness({ draft, errors, onType, onName, onCategory }: StepProps) {
  const t = useTranslations('onboarding');
  const { data: categories } = useOnboardingCategories(draft.type);

  return (
    <>
      <div>
        <h1 className={s.h1}>{t('step1.title')}</h1>
        <p className={s.lead}>{t('step1.lead')}</p>
      </div>
      <div className={s.seg2} role="radiogroup" aria-label={t('step1.typeLabel')}>
        {TYPES.map(({ value, icon, tint }) => (
          <label key={value} className={s.panel}>
            <input
              type="radio"
              name="type"
              value={value}
              checked={draft.type === value}
              onChange={() => onType(value)}
            />
            <span className={cn(s.segIc, s[tint])}>
              <OnbIcon name={icon} size={28} />
            </span>
            {t(`step1.${value}`)}
            <small>{t(`step1.${value}Hint`)}</small>
          </label>
        ))}
      </div>
      <div className={s.err}>{errors.has('type') ? t('errors.type') : ''}</div>
      <div className={cn(s.list, s.panel)}>
        <Field
          id="name"
          label={t('step1.name')}
          value={draft.name}
          error={errors.has('name') ? t('errors.name') : null}
          onValue={onName}
          maxLength={40}
          placeholder={t('step1.namePlaceholder')}
          autoComplete="organization"
        />
      </div>
      {draft.type && (
        <div className={s.group}>
          <div className={s.groupT}>{t('step1.category')}</div>
          <div className={s.chips}>
            {categories?.map((c) => (
              <button
                key={c.id}
                type="button"
                className={cn(s.chip, draft.cat === c.id && s.on)}
                aria-pressed={draft.cat === c.id}
                onClick={() => onCategory(c.id)}
              >
                {t(`categories.${c.id}` as 'categories.fashion')}
              </button>
            ))}
          </div>
          <div className={s.err}>{errors.has('cat') ? t('errors.cat') : ''}</div>
        </div>
      )}
    </>
  );
}
