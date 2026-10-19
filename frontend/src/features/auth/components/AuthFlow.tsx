'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { LanguageSwitcher } from '@/components/ui';
import { useSession } from '@/lib/auth';
import { useRouter } from '@/lib/i18n/navigation';

import { AuthPageContext, useFlowActions, useNextParam } from '../hooks/useFlowActions';
import { useFlowStore } from '../store';
import { FIRST_STEP, PAGE_STEPS, isStep, type AuthPage, type Step } from '../types';
import { afterSignIn } from '../util/nextPath';
import { CodeStep } from './CodeStep';
import { GoogleChooser } from './GoogleChooser';
import { LoginStep } from './LoginStep';
import { NewpassStep } from './NewpassStep';
import { BackLink, ShellContext, StepLink } from './parts';
import { PhonenameStep } from './PhonenameStep';
import { PhoneStep } from './PhoneStep';
import { Showcase } from './Showcase';
import { SignupStep } from './SignupStep';
import s from './signIn.module.css';

type Flow = ReturnType<typeof useFlowStore.getState>;

/** Steps whose screen manages its own focus (code boxes, the Google sheet). */
const OWN_FOCUS: readonly Step[] = [
  'verify',
  'email-code',
  'reset-code',
  'phone-code',
  'google',
  'google-new',
];

/**
 * The step to show for a requested one on this page, given what the flow knows. Steps that need
 * state the page no longer has (after a reload or a deep link) fall back to the first step.
 */
function resolveStep(page: AuthPage, step: Step, flow: Flow): Step {
  const first = FIRST_STEP[page];
  if (!PAGE_STEPS[page].includes(step)) return first;
  const otp = flow.otp?.purpose;
  switch (step) {
    case 'verify':
      return otp === 'verify' && flow.pending ? step : first;
    case 'email-code':
      return otp === 'login' ? step : first;
    case 'reset-code':
      return otp === 'reset' ? step : first;
    case 'phone-code':
      return otp === 'phone' ? step : 'phone';
    case 'new-password':
      return flow.email && flow.verified === 'reset' && flow.resetToken ? step : first;
    case 'phone-name':
      return flow.phone && flow.verified === 'phone' && flow.phoneToken ? step : 'phone';
    default:
      return step;
  }
}

/**
 * The auth pages: `/sign-in` (log in) and `/sign-up` (create an account). One client flow per
 * page with the step in the URL (`?step=`), so refresh and back/forward work.
 */
export function AuthFlow({ page }: { page: AuthPage }) {
  return (
    <AuthPageContext.Provider value={page}>
      <Flow page={page} />
    </AuthPageContext.Provider>
  );
}

function Flow({ page }: { page: AuthPage }) {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const params = useSearchParams();
  const raw = params.get('step');
  const first = FIRST_STEP[page];
  const requested: Step = isStep(raw) ? raw : first;
  const emailParam = params.get('email')?.trim().toLowerCase() ?? null;
  const next = useNextParam();
  const session = useSession();
  const flow = useFlowStore();
  const router = useRouter();
  const { go } = useFlowActions();
  const [shell, setShell] = useState<HTMLElement | null>(null);
  const card = useRef<HTMLElement>(null);

  useEffect(() => {
    useFlowStore.getState().patch({ leaving: false, target: null });
  }, []);

  // An email carried over from the other page (`?email=`) prefills the first step.
  useEffect(() => {
    if (emailParam) useFlowStore.getState().patch({ email: emailParam });
  }, [emailParam]);

  // The URL caught up with the step we navigated to.
  useEffect(() => {
    if (flow.target && flow.target === requested) useFlowStore.getState().patch({ target: null });
  }, [flow.target, requested]);

  // Wait for the persisted user to be checked (refresh) before deciding they're signed in.
  const checked = session.ready && session.validated;
  const redirecting = checked && session.signedIn && !flow.leaving;
  const shown: Step | null = !checked
    ? null
    : flow.leaving
      ? (flow.target ?? requested)
      : redirecting
        ? null
        : resolveStep(page, flow.target ?? requested, flow);

  // Signed in already: nothing to do here, so open the app (or `?next=`).
  useEffect(() => {
    if (!redirecting) return;
    useFlowStore.getState().patch({ leaving: true });
    router.replace(afterSignIn(next));
  }, [redirecting, next, router]);

  // Fix up the URL when the requested step can't be shown (deep link, reload).
  useEffect(() => {
    if (!shown || flow.target || flow.leaving) return;
    if (shown !== requested) go(shown, { replace: true });
  }, [shown, requested, flow.target, flow.leaving, go]);

  // Like the prototype's go(): focus the first field and scroll up.
  useEffect(() => {
    if (!shown) return;
    if (!OWN_FOCUS.includes(shown)) {
      const f = card.current?.querySelector<HTMLInputElement>(
        'input:not([hidden]):not([type=radio]):not([type=checkbox])',
      );
      f?.focus({ preventScroll: true });
    }
    window.scrollTo(0, 0);
  }, [shown]);

  const initialEmail = emailParam ?? flow.email;
  const firstStep =
    page === 'sign-in' ? (
      <LoginStep initialEmail={initialEmail} />
    ) : (
      <SignupStep initialEmail={initialEmail} />
    );

  let body: ReactNode = null;
  let sheet: ReactNode = null;
  switch (shown) {
    case 'login':
    case 'signup':
      body = firstStep;
      break;
    case 'google':
    case 'google-new':
      body = firstStep;
      sheet = <GoogleChooser mode={shown === 'google' ? 'list' : 'new'} />;
      break;
    case 'phone':
      body = <PhoneStep />;
      break;
    case 'verify':
    case 'email-code':
    case 'reset-code':
    case 'phone-code':
      body = flow.otp ? <CodeStep otp={flow.otp} /> : null;
      break;
    case 'new-password':
      body = <NewpassStep />;
      break;
    case 'phone-name':
      body = <PhonenameStep />;
      break;
    case 'help':
    case 'terms':
    case 'privacy':
      body = (
        <>
          <BackLink to={first} />
          <div>
            <h1>{t(`static.${shown}`)}</h1>
          </div>
        </>
      );
      break;
  }

  // The first step stays mounted under the Google sheet, so its typed values survive.
  const cardKey = shown === 'google' || shown === 'google-new' ? first : (shown ?? 'loading');

  return (
    <ShellContext.Provider value={shell}>
      <div className={s.shell} ref={setShell}>
        <div className={s.col}>
          <div className={s.top}>
            <a
              className={s.logo}
              href={`/${page}`}
              aria-label={tc('appName')}
              onClick={(e) => {
                e.preventDefault();
                go(first);
              }}
            >
              <span className={s.logoMark}>B</span>
              <span>
                Virtual<b>Biz</b>
              </span>
            </a>
            <LanguageSwitcher />
          </div>
          <div className={s.mid}>
            <main className={s.card} ref={card} aria-live="polite" key={cardKey}>
              {body}
            </main>
          </div>
          <div className={s.foot}>
            <span>{t('footer.copyright')}</span>
            <nav>
              <StepLink step="help">{t('footer.help')}</StepLink>
              <StepLink step="terms">{t('footer.terms')}</StepLink>
              <StepLink step="privacy">{t('footer.privacy')}</StepLink>
            </nav>
          </div>
        </div>
        <Showcase />
      </div>
      {sheet}
    </ShellContext.Provider>
  );
}
