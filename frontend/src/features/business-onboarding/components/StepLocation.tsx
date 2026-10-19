'use client';

import { useTranslations } from 'next-intl';

import { LocationPicker } from '@/components/location/LocationPicker';
import { cn } from '@/lib/utils/cn';

import { useDistricts } from '../queries';
import type { BusinessDraft, DraftProblem } from '../types';
import { Field } from './Field';
import s from './onboarding.module.css';

interface StepProps {
  draft: BusinessDraft;
  errors: ReadonlySet<DraftProblem>;
  onChange: (patch: Partial<BusinessDraft>, clears?: DraftProblem) => void;
  onHours: () => void;
}

/**
 * Step 2: the shop's pin (GPS, map or search, which fills district + street), then district,
 * street and customer phone typed or corrected by hand, and the opening-hours summary.
 */
export function StepLocation({ draft, errors, onChange, onHours }: StepProps) {
  const t = useTranslations('onboarding');
  const tc = useTranslations('common');
  const { data: districts } = useDistricts();

  return (
    <>
      <div>
        <h1 className={s.h1}>{t('step2.title')}</h1>
        <p className={s.lead}>{t('step2.lead')}</p>
      </div>
      <LocationPicker
        value={draft.lat != null && draft.lng != null ? { lat: draft.lat, lng: draft.lng } : null}
        district={draft.district}
        onPick={(p) =>
          onChange(
            {
              lat: p.lat,
              lng: p.lng,
              ...(p.district ? { district: p.district } : {}),
              ...(p.line ? { street: p.line } : {}),
            },
            p.line ? 'street' : undefined,
          )
        }
      />
      <div className={cn(s.list, s.panel)}>
        <div className={s.cell}>
          <label htmlFor="district">{t('step2.district')}</label>
          <select
            id="district"
            value={draft.district}
            onChange={(e) => onChange({ district: e.target.value })}
          >
            {districts?.map((d) => (
              <option key={d.id} value={d.name}>
                {tc(`districts.${d.id}` as 'districts.toul-kork')}
              </option>
            ))}
          </select>
        </div>
        <Field
          id="street"
          label={t('step2.street')}
          value={draft.street}
          error={errors.has('street') ? t('errors.street') : null}
          onValue={(street) => onChange({ street }, 'street')}
          placeholder={t('step2.streetPlaceholder')}
          autoComplete="address-line1"
        />
        <Field
          id="phone"
          label={t('step2.phone')}
          value={draft.phone}
          error={errors.has('phone') ? t('errors.phone') : null}
          onValue={(phone) => onChange({ phone }, 'phone')}
          inputMode="tel"
          autoComplete="tel"
        />
      </div>
      <div className={cn(s.list, s.panel)}>
        <div className={s.hrsLine}>
          <span>
            <span className={cn(s.small, s.muted, s.block)}>{t('step2.hours')}</span>
            <b className={cn(s.hrsValue, s.num)}>
              {draft.sunday ? t('step2.everyDay') : t('step2.monSat')} · {draft.open}–{draft.close}
            </b>
          </span>
          <button type="button" className={s.link} onClick={onHours}>
            {t('step2.change')}
          </button>
        </div>
      </div>
    </>
  );
}
