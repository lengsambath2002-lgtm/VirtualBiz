'use client';

import { create } from 'zustand';

import type { MethodKey, OtpState, Step } from './types';

/** Sign-up waiting for its email code (kept to resend the code; the account is made on verify). */
export interface PendingSignup {
  name: string;
  email: string;
  password: string;
}

/** In-memory state of the auth pages (the prototype's `S`). Not persisted, like the prototype. */
interface FlowState {
  /** Email typed on either page; carried across steps and between /sign-in and /sign-up. */
  email: string;
  phone: string;
  pending: PendingSignup | null;
  otp: OtpState | null;
  /**
   * A sign-in stopped for two-step sign-in: the ticket for `/auth/two-step` and how the person
   * signed in (for the session once the code is right).
   */
  twoStep: { ticket: string; method: MethodKey } | null;
  /** Epoch ms until which the password form is locked (ACCOUNT_LOCKED). */
  lockUntil: number;
  /** A code was just verified for a password reset / an unknown phone (unlocks new-password / phone-name). */
  verified: 'reset' | 'phone' | null;
  /** From the verified reset code (`/password/reset/verify`), single use, 10 minutes. */
  resetToken: string | null;
  /** From verifying an unknown phone (`/phone/verify` → NEW), for `/phone/register`. */
  phoneToken: string | null;
  /** Step being navigated to; shown right away while the URL catches up. */
  target: Step | null;
  /** Leaving the page after signing in; suppresses step redirects. */
  leaving: boolean;
  patch: (p: Partial<Omit<FlowState, 'patch'>>) => void;
}

export const useFlowStore = create<FlowState>()((set) => ({
  email: '',
  phone: '',
  pending: null,
  otp: null,
  twoStep: null,
  lockUntil: 0,
  verified: null,
  resetToken: null,
  phoneToken: null,
  target: null,
  leaving: false,
  patch: (p) => set(p),
}));
