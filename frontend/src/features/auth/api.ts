// Auth endpoints (`/api/auth/**`, docs/api/phase1-auth-account-business.md). None of them send
// the bearer token: they sign in, or use the refresh cookie.
import {
  apiFetch,
  type AuthSession,
  type LookupResult,
  type OtpPurposeWire,
  type OtpSent,
  type PhoneVerifyResult,
} from '@/lib/api';

const post = <T>(path: string, body?: unknown) =>
  apiFetch<T>(`/auth${path}`, { method: 'POST', body, auth: false });

export const lookup = (email: string) => post<LookupResult>('/lookup', { email });

/** Errors: INVALID_CREDENTIALS (`meta.reason` NO_ACCOUNT | BAD_PASSWORD, `meta.triesLeft`), ACCOUNT_LOCKED. */
export const login = (email: string, password: string) =>
  post<AuthSession>('/login', { email, password });

/** Send a 6-digit code. Errors: OTP_RESEND_TOO_SOON (`meta.retryAfter`), USER_NOT_FOUND. */
export const sendOtp = (purpose: OtpPurposeWire, to: string) =>
  post<OtpSent>('/otp', { purpose, to });

/** Store the pending sign-up and send the VERIFY code. Errors: CONFLICT (email), VALIDATION_FAILED. */
export const signup = (input: { name: string; email: string; password: string }) =>
  post<OtpSent>('/signup', input);

export const verifySignup = (email: string, code: string) =>
  post<AuthSession>('/signup/verify', { email, code });

export const loginWithCode = (email: string, code: string) =>
  post<AuthSession>('/login/code', { email, code });

export const verifyReset = (email: string, code: string) =>
  post<{ resetToken: string }>('/password/reset/verify', { email, code });

export const resetPassword = (resetToken: string, password: string) =>
  post<AuthSession>('/password/reset', { resetToken, password });

export const verifyPhone = (phone: string, code: string) =>
  post<PhoneVerifyResult>('/phone/verify', { phone, code });

export const registerPhone = (input: { phoneToken: string; name: string; email?: string }) =>
  post<AuthSession>('/phone/register', input);

/** Real Google: the ID token from Google Identity Services. */
export const googleSignIn = (idToken: string) => post<AuthSession>('/google', { idToken });

/** Local / dev only: stands in for Google until a client id is configured. */
export const googleDevSignIn = (email: string, name: string) =>
  post<AuthSession>('/google/dev', { email, name });

/** A Firebase ID token (Google, or email + password) becomes a VirtualBiz session. Errors: INVALID_TOKEN, EMAIL_NOT_VERIFIED. */
export const firebaseSignIn = (idToken: string, name?: string) =>
  post<AuthSession>('/firebase', { idToken, name });

/** Checks the password VirtualBiz keeps and gives the account's Firebase login the same one. Errors as `login`. */
export const firebaseMigrate = (email: string, password: string) =>
  post<void>('/firebase/migrate', { email, password });

/** Which ways in the server can deliver: `phone` is false while no SMS provider is connected. */
export const signInMethods = () =>
  apiFetch<{ phone: boolean }>('/auth/methods', { auth: false });
