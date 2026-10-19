// Sign-in rules, ported 1:1 from the Sign-in prototype.
import { isValidPhone, normalizePhone } from '@/lib/utils/phone';

/** A code lasts 10 minutes. */
export const OTP_TTL_MS = 10 * 60_000;
/** "Resend code" unlocks after 30 s. */
export const RESEND_MS = 30_000;
/** 5 wrong codes and the code is dead; send a new one. */
export const OTP_MAX = 5;
/** 5 wrong passwords lock the password form… */
export const LOGIN_MAX = 5;
/** …for 30 s (login by code stays available). */
export const LOCK_MS = 30_000;
export const CODE_LENGTH = 6;

export const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

const TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
};

/** Suggest a fix for a common email-domain typo ("nita@gmial.com" → "nita@gmail.com"). */
export function emailTypo(v: string): string | null {
  const [u, d] = v.split('@');
  const fix = d ? TYPOS[d.toLowerCase()] : undefined;
  return fix ? `${u}@${fix}` : null;
}

export type PasswordRule = 'len' | 'case' | 'num' | 'sym';
export const PASSWORD_RULES: readonly [PasswordRule, (v: string) => boolean][] = [
  ['len', (v) => v.length >= 8],
  ['case', (v) => /[a-z]/.test(v) && /[A-Z]/.test(v)],
  ['num', (v) => /\d/.test(v)],
  ['sym', (v) => /[^A-Za-z0-9]/.test(v)],
];
export const passwordOk = (v: string) => PASSWORD_RULES.every(([, test]) => test(v));

/** True when the password contains the email's local part (sign-up rule). */
export const containsEmailName = (password: string, email: string) =>
  password.toLowerCase().includes(email.split('@')[0] ?? '');

export const initials = (n: string) =>
  (n || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

/** As-you-type mask for the phone field: "012345678" → "012 345 678" (max 10 digits). */
export function maskPhoneInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 10);
  return d.replace(/^(\d{3})(\d{3})(\d{0,4}).*/, (_, a: string, b: string, c: string) =>
    [a, b, c].filter(Boolean).join(' '),
  );
}

/**
 * Normalize what the user typed to "0XXXXXXXX". On top of the shared helper (+855 → 0) the
 * prototype also accepts a number typed without its leading 0 ("12 345 678").
 */
export function normalizePhoneInput(raw: string): string {
  let d = normalizePhone(raw);
  if (d && !d.startsWith('0')) d = '0' + d;
  return d;
}

export const phoneInputOk = (normalized: string) => isValidPhone(normalized);
