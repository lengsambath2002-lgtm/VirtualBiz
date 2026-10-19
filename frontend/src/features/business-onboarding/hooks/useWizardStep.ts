'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

import { useRouter } from '@/lib/i18n/navigation';

import type { BusinessDraft, WizardStep } from '../types';
import { furthestStep } from '../util/draft';

export type WizardView = WizardStep | 'done';

const PATH = '/create-business';
const href = (view: WizardView) => `${PATH}?step=${view}`;

function parseStep(raw: string | null): WizardStep | 'done' | null {
  if (raw === 'done') return 'done';
  const n = Number(raw);
  return n === 1 || n === 2 || n === 3 ? n : null;
}

/**
 * The wizard step lives in the URL (`?step=1|2|3|done`) so browser back/forward work. The
 * URL can't skip ahead of what the draft has completed, and once the shop is open the done
 * screen is the only view (as in the prototype). `draft.step` mirrors the URL so a later
 * visit resumes where the user left off.
 */
export function useWizardStep(
  draft: BusinessDraft,
  update: (p: Partial<BusinessDraft>) => void,
  ready: boolean,
) {
  const router = useRouter();
  const requested = parseStep(useSearchParams().get('step'));

  const max = furthestStep(draft);
  let view: WizardView;
  if (draft.done) view = 'done';
  else {
    const want = requested === null || requested === 'done' ? draft.step : requested;
    view = Math.min(want, max) as WizardStep;
  }

  // The first step shown in this visit: steps above it were pushed, so Back can pop them.
  const entry = useRef<WizardView | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (entry.current === null) entry.current = view;
    if (requested !== view) router.replace(href(view), { scroll: false });
    if (view !== 'done' && view !== draft.step) update({ step: view });
  }, [ready, requested, view, draft.step, router, update]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  const next = useCallback(() => {
    if (view === 'done' || view === 3) return;
    router.push(href((view + 1) as WizardStep), { scroll: false });
  }, [router, view]);

  const back = useCallback(() => {
    if (view === 'done' || view === 1) return;
    const prev = (view - 1) as WizardStep;
    const entered = entry.current;
    if (typeof entered === 'number' && view > entered) router.back();
    else {
      entry.current = prev;
      router.replace(href(prev), { scroll: false });
    }
  }, [router, view]);

  const finish = useCallback(() => {
    update({ done: true });
    router.replace(href('done'), { scroll: false });
  }, [router, update]);

  return { view, next, back, finish };
}
