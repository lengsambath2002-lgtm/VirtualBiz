import type { CreateBusinessInput } from '@/lib/api';
import { normalizePhone } from '@/lib/utils/phone';

import { ONBOARDING_CATEGORIES } from '../categories';

import type { BusinessDraft, DraftProblem } from '../types';

/**
 * Create Business's category chips are broader than the platform categories; the API takes the
 * platform id each chip maps to, or the chip's own id for onboarding-only categories.
 */
export function platformCategoryId(cat: string): string {
  return ONBOARDING_CATEGORIES.find((c) => c.id === cat)?.platformCategoryId ?? cat;
}

/** The finished wizard as `POST /api/businesses`. */
export function draftToCreateInput(d: BusinessDraft): CreateBusinessInput {
  return {
    type: d.type === 'service' ? 'SERVICE' : 'PRODUCT',
    name: d.name.trim(),
    categoryId: platformCategoryId(d.cat),
    district: d.district,
    street: d.street.trim(),
    ...(d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : {}),
    phone: normalizePhone(d.phone),
    hours: { open: d.open, close: d.close, sunday: d.sunday },
    ...(d.bakong.trim() ? { bakongId: d.bakong.trim() } : {}),
    ...(d.idPhoto ? { idPhoto: d.idPhoto } : {}),
  };
}

/** Wizard field an API validation error is about (request field name → draft problem). */
const FIELD_PROBLEM: Record<string, DraftProblem> = {
  type: 'type',
  name: 'name',
  categoryId: 'cat',
  street: 'street',
  phone: 'phone',
  bakongId: 'bakong',
  idPhoto: 'id',
};

export const problemForField = (field: string | null | undefined): DraftProblem | undefined =>
  field ? FIELD_PROBLEM[field] : undefined;
