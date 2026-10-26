/** The two auth pages. Each has its own first step and its own set of steps. */
export type AuthPage = 'sign-in' | 'sign-up';

/** Every screen of the auth pages. Reflected in the URL as `?step=<step>` (the first step has none). */
export const STEPS = [
  // /sign-in
  'login',
  'email-code',
  'reset-code',
  'new-password',
  // /sign-up
  'signup',
  'verify',
  // both
  'google',
  'google-new',
  'phone',
  'phone-code',
  'phone-name',
  'help',
  // after any sign-in, for an account with two-step sign-in on
  'two-step',
] as const;
export type Step = (typeof STEPS)[number];

/** First step of each page (shown without `?step=`). */
export const FIRST_STEP: Record<AuthPage, Step> = { 'sign-in': 'login', 'sign-up': 'signup' };

/** Steps each page can show. Anything else falls back to the page's first step. */
export const PAGE_STEPS: Record<AuthPage, readonly Step[]> = {
  'sign-in': [
    'login',
    'email-code',
    'reset-code',
    'new-password',
    'google',
    'google-new',
    'phone',
    'phone-code',
    'phone-name',
    'help',
    'two-step',
  ],
  'sign-up': [
    'signup',
    'verify',
    'google',
    'google-new',
    'phone',
    'phone-code',
    'phone-name',
    'help',
    'two-step',
  ],
};

export function isStep(value: unknown): value is Step {
  return typeof value === 'string' && (STEPS as readonly string[]).includes(value);
}

/** What a 6-digit code is for: verify a sign-up email, email-code login, password reset, phone SMS. */
export type CodePurpose = 'verify' | 'login' | 'reset' | 'phone';

/** The step that shows the code screen for each purpose. */
export const CODE_STEP: Record<CodePurpose, Step> = {
  verify: 'verify',
  login: 'email-code',
  reset: 'reset-code',
  phone: 'phone-code',
};

export interface OtpState {
  purpose: CodePurpose;
  /** Email address, or normalized phone ("012345678") for `phone`. */
  to: string;
  /** Epoch ms after which the code is rejected (10 minutes). */
  exp: number;
  /** Epoch ms when "resend code" unlocks (30 s). */
  resendAt: number;
  /** Increments on every send, so the code screen resets on resend. */
  seq: number;
}

/** How the user signed in; mapped to the session's `SignInMethod`. */
export type MethodKey = 'password' | 'signup' | 'emailCode' | 'reset' | 'phone' | 'google';
