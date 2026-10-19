'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, useSyncExternalStore, type KeyboardEvent } from 'react';

import { fallbackErrorKey, isApiError } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { useRouter } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';
import { setActiveBusiness } from '@/lib/workspace';

import { useBusinessDraft } from '../hooks/useBusinessDraft';
import { useToast } from '../hooks/useToast';
import { useWizardStep, type WizardView } from '../hooks/useWizardStep';
import { useCreateBusiness } from '../queries';
import type { BusinessDraft, DraftProblem, TodoKey } from '../types';
import { checkStep, SHOP_HOST, shopSlug } from '../util/draft';
import { draftToCreateInput, problemForField } from '../util/toBusiness';
import { DoneScreen } from './DoneScreen';
import { HoursSheet } from './HoursSheet';
import { OnbIcon } from './icons';
import s from './onboarding.module.css';
import { StepBusiness } from './StepBusiness';
import { StepLocation } from './StepLocation';
import { StepPayout } from './StepPayout';
import { WizardNav } from './WizardNav';

/** Signed-out visitors ("Open your shop") create an account first, then come back here. */
const SIGN_UP = '/sign-up?next=/create-business';
const NO_ERRORS: ReadonlySet<DraftProblem> = new Set();
/** Problems the API can report that step 3 (where "Open my shop" is) can show by its field. */
const STEP3_FIELDS: readonly DraftProblem[] = ['bakong', 'id'];

const subscribeNoop = () => () => {};

/**
 * Renders the wizard on the client only. The session store (`useSession`) has no persist API
 * during SSR, and everything here depends on the signed-in user and the localStorage draft.
 */
export function CreateBusinessWizard() {
  const client = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  return client ? <Wizard /> : <div className={s.root} />;
}

/**
 * Create Business wizard ("Simple version: 3 steps"): type + name + category → where →
 * get paid → done. Requires a signed-in user; the draft persists in localStorage `vb-biz2`.
 */
function Wizard() {
  const t = useTranslations('onboarding');
  const tc = useTranslations('common');
  const router = useRouter();
  const session = useSession();
  const user = session.user;
  const { draft, update, reset, ready } = useBusinessDraft(user?.phone);
  const active = ready && session.ready && user !== null;
  const { view, next, back, finish } = useWizardStep(draft, update, active);
  const { toast, show } = useToast();
  const locale = useLocale();
  const params = useSearchParams();

  // "Create a new business" (?new=1) after one was opened: start a fresh draft.
  useEffect(() => {
    if (!ready || params.get('new') !== '1') return;
    if (draft.done) reset();
    router.replace('/create-business');
  }, [ready, params, draft.done, reset, router]);

  // Errors belong to the view they were raised on; any re-render of the step from new
  // data (type change, photo) clears them, as the prototype's full re-render does.
  const [errorState, setErrorState] = useState<{ view: WizardView; set: Set<DraftProblem> }>();
  const errors = errorState?.view === view ? errorState.set : NO_ERRORS;
  const [opening, setOpening] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  /** Why "Open my shop" failed (shown above the button). */
  const [openError, setOpenError] = useState<string | null>(null);
  const create = useCreateBusiness();

  useEffect(() => {
    if (session.ready && !user) router.replace(SIGN_UP);
  }, [session.ready, user, router]);

  const clearError = (k: DraftProblem) => {
    if (!errors.has(k)) return;
    const set = new Set(errors);
    set.delete(k);
    setErrorState({ view, set });
  };
  const change = (patch: Partial<BusinessDraft>, clears?: DraftProblem) => {
    update(patch);
    if (clears) clearError(clears);
  };

  /** Continue, or open the shop on step 3. `skipPayout` opens it without payout details. */
  const onNext = async (skipPayout = false) => {
    if (view === 'done' || opening) return;
    const d = skipPayout ? { ...draft, bakong: '', idPhoto: null } : draft;
    if (skipPayout) {
      update({ bakong: '', idPhoto: null });
      setErrorState({ view, set: new Set() });
    }
    const problems = checkStep(d, view);
    if (problems.length) {
      setErrorState({ view, set: new Set(problems) });
      return;
    }
    if (view < 3) return next();
    setOpening(true);
    setOpenError(null);
    if (user && !draft.createdId) {
      try {
        const created = await create.mutateAsync(draftToCreateInput(d));
        update({ createdId: created.id });
      } catch (e) {
        setOpening(false);
        // A field on this step gets its own message; anything else is said above the button.
        const fields = isApiError(e, 'VALIDATION_FAILED')
          ? e.details.map((d) => problemForField(d.field)).filter((p) => p !== undefined)
          : [];
        const here = fields.filter((p) => STEP3_FIELDS.includes(p));
        if (here.length) setErrorState({ view, set: new Set(here) });
        else
          setOpenError(
            isApiError(e) && e.status >= 400 && e.status < 500
              ? t('errors.server')
              : tc(fallbackErrorKey(e)),
          );
        return;
      }
    }
    finish();
    setOpening(false);
  };

  // Enter in a text field acts as Continue.
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const el = e.target as HTMLElement;
    if (e.key === 'Enter' && el.tagName === 'INPUT' && el.closest('[data-cell]')) {
      e.preventDefault();
      void onNext();
    }
  };

  // ✕ keeps the draft (or the opened shop) and leaves the wizard; the toast says where to resume.
  const close = () => {
    show(view === 'done' ? t('toast.saved') : t('toast.savedDraft'));
    setTimeout(() => router.push('/home'), 700);
  };

  const closeHours = useCallback(() => setHoursOpen(false), []);
  const link = `https://${SHOP_HOST}/${shopSlug(draft.name)}`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* clipboard blocked: the prototype still confirms */
    }
    show(t('toast.linkCopied'));
  };

  if (!active) return <div className={s.root} />;

  return (
    <div className={s.root}>
      <WizardNav view={view} shopName={draft.name} onBack={back} onClose={close} />
      <div className={s.wrap}>
        <main className={s.main} aria-live="polite" onKeyDown={onKeyDown}>
          {view === 1 && (
            <StepBusiness
              draft={draft}
              errors={errors}
              onType={(type) => {
                update({ type, cat: '' });
                setErrorState(undefined);
              }}
              onName={(name) => change({ name }, 'name')}
              onCategory={(cat) => change({ cat }, 'cat')}
            />
          )}
          {view === 2 && (
            <StepLocation
              draft={draft}
              errors={errors}
              onChange={change}
              onHours={() => setHoursOpen(true)}
            />
          )}
          {view === 3 && (
            <StepPayout
              draft={draft}
              errors={errors}
              onBakong={(bakong) => change({ bakong }, 'bakong')}
              onPhoto={(idPhoto) => {
                update({ idPhoto });
                setErrorState(undefined);
              }}
              onTooLarge={() => show(t('toast.photoTooLarge'))}
            />
          )}
          {view === 'done' && (
            <DoneScreen
              draft={draft}
              onTodo={(k: TodoKey) => update({ todo: { ...draft.todo, [k]: true } })}
              onShare={() => {
                update({ todo: { ...draft.todo, share: true } });
                void copyLink();
              }}
              onCopy={() => void copyLink()}
            />
          )}
        </main>
      </div>
      <div className={s.actbar}>
        <div className={s.actbarIn}>
          {openError && view === 3 && (
            <p className={s.openError} role="alert">
              {openError}
            </p>
          )}
          {view === 'done' ? (
            <button
              type="button"
              className={cn(s.btn, s.btnPrimary, s.btnBlock)}
              onClick={() => {
                show(t('toast.opening', { name: draft.name }));
                const type = draft.type === 'service' ? 'SERVICE' : 'PRODUCT';
                if (draft.createdId) setActiveBusiness(type, draft.createdId);
                // A full load so the workspace opens on the new business.
                window.location.assign(`/${locale}${type === 'SERVICE' ? '/provider' : '/seller'}`);
              }}
            >
              <OnbIcon name="swap" size={18} />
              {t('done.goToShop')}
            </button>
          ) : (
            <button
              type="button"
              className={cn(s.btn, s.btnPrimary, s.btnBlock)}
              disabled={opening}
              onClick={() => void onNext()}
            >
              {opening ? (
                <>
                  <span className={s.spin} />
                  {t('actions.opening')}
                </>
              ) : view === 3 ? (
                t('actions.open')
              ) : (
                t('actions.continue')
              )}
            </button>
          )}
          {view === 3 && !opening && (
            <button
              type="button"
              className={cn(s.btn, s.btnGhost, s.btnBlock)}
              onClick={() => void onNext(true)}
            >
              {t('step3.skip')}
            </button>
          )}
        </div>
      </div>
      {hoursOpen && view === 2 && (
        <HoursSheet
          draft={draft}
          onClose={closeHours}
          onInvalid={() => show(t('toast.closeAfterOpen'))}
          onSave={(hours) => {
            update(hours);
            setHoursOpen(false);
          }}
        />
      )}
      {toast && (
        <div key={toast.id} className={s.toast} role="status">
          {toast.message}
        </div>
      )}
    </div>
  );
}
