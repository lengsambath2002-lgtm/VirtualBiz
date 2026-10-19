'use client';

import { useTranslations } from 'next-intl';
import type { ChangeEvent } from 'react';

import { cn } from '@/lib/utils/cn';

import type { BusinessDraft, DraftProblem } from '../types';
import { MAX_ID_PHOTO_BYTES } from '../util/draft';
import { Field } from './Field';
import { OnbIcon } from './icons';
import s from './onboarding.module.css';

interface StepProps {
  draft: BusinessDraft;
  errors: ReadonlySet<DraftProblem>;
  onBakong: (bakong: string) => void;
  onPhoto: (dataUrl: string) => void;
  onTooLarge: () => void;
}

/** Step 3: Bakong ID and a photo of the owner's ID (camera or file, ≤ 8 MB). */
export function StepPayout({ draft, errors, onBakong, onPhoto, onTooLarge }: StepProps) {
  const t = useTranslations('onboarding');
  const has = Boolean(draft.idPhoto);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (f.size > MAX_ID_PHOTO_BYTES) return onTooLarge();
    const r = new FileReader();
    r.onload = () => {
      if (typeof r.result === 'string') onPhoto(r.result);
    };
    r.readAsDataURL(f);
  };

  return (
    <>
      <div>
        <h1 className={s.h1}>{t('step3.title')}</h1>
        <p className={s.lead}>{t('step3.lead')}</p>
      </div>
      <div className={cn(s.list, s.panel)}>
        <Field
          id="bakong"
          label={`${t('step3.bakong')} · ${t('step3.optional')}`}
          value={draft.bakong}
          error={errors.has('bakong') ? t('errors.bakong') : null}
          onValue={onBakong}
          placeholder={t('step3.bakongPlaceholder')}
          autoCapitalize="none"
          spellCheck={false}
          style={{ fontFamily: 'var(--f-mono)' }}
        />
      </div>
      <p className={s.hint}>
        {t.rich('step3.bakongHint', {
          b: (c) => <b>{c}</b>,
          mono: (c) => <span className={s.mono}>{c}</span>,
        })}
      </p>
      <div className={cn(s.list, s.panel)}>
        <label className={cn(s.idup, has && s.done)}>
          <span
            className={s.th}
            style={draft.idPhoto ? { backgroundImage: `url(${draft.idPhoto})` } : undefined}
          >
            {!has && <OnbIcon name="id" size={28} />}
          </span>
          <span>
            <b style={{ fontWeight: 600 }}>
              {has ? t('step3.idAdded') : `${t('step3.idTitle')} · ${t('step3.optional')}`}
            </b>
            <span className={cn(s.small, s.block, has ? s.okT : s.muted)}>
              {has ? t('step3.idRetake') : t('step3.idHint')}
            </span>
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            aria-label={t('step3.idUpload')}
            onChange={onFile}
          />
        </label>
      </div>
      <div className={s.err}>{errors.has('id') ? t('errors.id') : ''}</div>
      <p className={cn(s.hint, s.hintIcon)}>
        <OnbIcon name="shield" size={15} />
        <span>{t('step3.privacy')}</span>
      </p>
    </>
  );
}
