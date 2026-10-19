import { formatPhone, normalizePhone } from '@/lib/utils/phone';

import type { BusinessDraft, DraftProblem, WizardStep } from '../types';

export const DRAFT_STORAGE_KEY = 'vb-biz2';
/** Largest ID photo accepted (prototype: `f.size > 8e6`). */
export const MAX_ID_PHOTO_BYTES = 8e6;
export const SHOP_HOST = 'virtualbiz.com.kh';

/** A fresh draft, prefilled with the signed-in user's phone (prototype `blank()`). */
export function blankDraft(userPhone?: string): BusinessDraft {
  return {
    type: '',
    name: '',
    cat: '',
    district: 'Toul Kork',
    street: '',
    phone: userPhone ? formatPhone(userPhone) : '',
    open: '08:00',
    close: '18:00',
    sunday: false,
    bakong: '',
    idPhoto: null,
    step: 1,
    done: false,
    verified: false,
    todo: {},
  };
}

const BAKONG_ID = /^[a-z0-9._-]+@[a-z]+$/i;
// Prototype: digits only, a leading 0 and 9–10 digits. `normalizePhone` also accepts +855.
const PHONE = /^0\d{8,9}$/;

/** The prototype's `check(step)`: which fields block leaving `step`. */
export function checkStep(d: BusinessDraft, step: WizardStep): DraftProblem[] {
  const p: DraftProblem[] = [];
  if (step === 1) {
    if (!d.type) p.push('type');
    if (d.name.trim().length < 2) p.push('name');
    if (!d.cat) p.push('cat');
  }
  if (step === 2) {
    if (d.street.trim().length < 3) p.push('street');
    if (!PHONE.test(normalizePhone(d.phone))) p.push('phone');
  }
  if (step === 3) {
    // Payout details are optional: a Bakong ID is only checked once one is typed.
    if (d.bakong.trim() && !BAKONG_ID.test(d.bakong.trim())) p.push('bakong');
  }
  return p;
}

/** The furthest step the draft may show: the first step that still has problems. */
export function furthestStep(d: BusinessDraft): WizardStep {
  if (checkStep(d, 1).length) return 1;
  if (checkStep(d, 2).length) return 2;
  return 3;
}

/** Shop URL slug (prototype `slug()`). */
export function shopSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** "HH:MM" strings compare correctly as text (prototype: `if (c <= o)`). */
export function isCloseAfterOpen(open: string, close: string): boolean {
  return close > open;
}
