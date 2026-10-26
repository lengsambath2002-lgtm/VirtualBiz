'use client';

import { useSearchParams } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo } from 'react';

import {
  isApiError,
  metaString,
  type AuthSession,
  type OtpPurposeWire,
  type OtpSent,
} from '@/lib/api';
import { useSessionStore } from '@/lib/auth';
import type { SignInMethod } from '@/lib/domain';
import { useRouter } from '@/lib/i18n/navigation';

import { sendOtp, signup } from '../api';
import { useFlowStore } from '../store';
import { FIRST_STEP, type AuthPage, type CodePurpose, type MethodKey, type Step } from '../types';
import { afterSignIn, safeNextPath } from '../util/nextPath';
import { OTP_TTL_MS, RESEND_MS } from '../util/rules';

const WIRE_PURPOSE: Record<CodePurpose, OtpPurposeWire> = {
  verify: 'VERIFY',
  login: 'LOGIN',
  reset: 'RESET',
  phone: 'PHONE',
};

/** Epoch ms from an API timestamp, or `now + fallback` when it is missing or unreadable. */
const epoch = (iso: string | undefined, fallback: number) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : Date.now() + fallback;
};

const SESSION_METHOD: Record<MethodKey, SignInMethod> = {
  password: 'PASSWORD',
  signup: 'PASSWORD',
  reset: 'PASSWORD',
  emailCode: 'EMAIL_CODE',
  phone: 'PHONE_SMS',
  google: 'GOOGLE',
};

/** Which auth page the steps are rendered on (`/sign-in` or `/sign-up`). */
export const AuthPageContext = createContext<AuthPage>('sign-in');
export const useAuthPage = () => useContext(AuthPageContext);

/** `?next=` as given, when it is a safe same-site path (null otherwise). */
export function useNextParam(): string | null {
  const raw = useSearchParams().get('next');
  return raw && safeNextPath(raw) ? raw : null;
}

/** Link target for the other auth page, carrying `?next=` and the typed email. */
export function usePageHref() {
  const next = useNextParam();
  return useCallback(
    (page: AuthPage, email?: string) => {
      const query: Record<string, string> = {};
      if (next) query.next = next;
      if (email) query.email = email;
      return { pathname: `/${page}` as const, query };
    },
    [next],
  );
}

/** Navigation and the shared transitions of the auth pages (the prototype's go / startCode / signIn). */
export function useFlowActions() {
  const router = useRouter();
  const page = useAuthPage();
  const next = useNextParam();

  const go = useCallback(
    (step: Step, opts: { replace?: boolean } = {}) => {
      useFlowStore.getState().patch({ target: step });
      const query: Record<string, string> = {};
      if (step !== FIRST_STEP[page]) query.step = step;
      if (next) query.next = next;
      const href = { pathname: `/${page}` as const, query };
      if (opts.replace) router.replace(href);
      else router.push(href);
    },
    [router, page, next],
  );

  /** After signing in: go to `?next=` if given, otherwise into the app. */
  const finish = useCallback(() => {
    useFlowStore.getState().patch({ leaving: true });
    router.replace(afterSignIn(next));
  }, [next, router]);

  /**
   * Send a new code (`/auth/otp`; a sign-up's VERIFY code is sent again by `/auth/signup` with
   * the pending sign-up). Throws `ApiError`. The code goes by email (or SMS) only, never on screen.
   */
  const startCode = useCallback(async (purpose: CodePurpose, to: string) => {
    const pending = useFlowStore.getState().pending;
    const sent: OtpSent =
      purpose === 'verify' && pending
        ? await signup(pending)
        : await sendOtp(WIRE_PURPOSE[purpose], to);
    const prev = useFlowStore.getState().otp;
    useFlowStore.getState().patch({
      otp: {
        purpose,
        to,
        exp: epoch(sent.expiresAt, OTP_TTL_MS),
        resendAt: epoch(sent.resendAt, RESEND_MS),
        seq: (prev?.seq ?? 0) + 1,
      },
      verified: null,
    });
  }, []);

  const signIn = useCallback(
    (session: AuthSession, method: MethodKey) => {
      // Mark that we're leaving before the session flips, so the signed-in redirect doesn't race.
      useFlowStore.getState().patch({
        leaving: true,
        twoStep: null,
        pending: null,
        resetToken: null,
        phoneToken: null,
        verified: null,
      });
      useSessionStore.getState().signIn(session, SESSION_METHOD[method]);
      finish();
    },
    [finish],
  );

  /**
   * A sign-in answered TWO_STEP_REQUIRED (two-step sign-in is on for the account): keep its ticket
   * and ask for the code. True when it did, so the caller stops there.
   */
  const askTwoStep = useCallback(
    (err: unknown, method: MethodKey) => {
      if (!isApiError(err, 'TWO_STEP_REQUIRED')) return false;
      const ticket = metaString(err, 'ticket');
      if (!ticket) return false;
      useFlowStore.getState().patch({ twoStep: { ticket, method } });
      go('two-step');
      return true;
    },
    [go],
  );

  return useMemo(
    () => ({ go, finish, startCode, signIn, askTwoStep }),
    [go, finish, startCode, signIn, askTwoStep],
  );
}
