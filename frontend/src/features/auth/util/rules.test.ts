import { afterSignIn, safeNextPath } from './nextPath';
import {
  containsEmailName,
  emailOk,
  emailTypo,
  maskPhoneInput,
  normalizePhoneInput,
  passwordOk,
  phoneInputOk,
} from './rules';

describe('sign-in rules', () => {
  it('validates emails and suggests typo fixes', () => {
    expect(emailOk('dom@virtualbiz.com')).toBe(true);
    expect(emailOk('dom@x.c')).toBe(false);
    expect(emailTypo('nita@GMIAL.com')).toBe('nita@gmail.com');
    expect(emailTypo('nita@gmail.com')).toBeNull();
  });

  it('requires all 4 password rules and rejects the email name', () => {
    expect(passwordOk('Demo@1234')).toBe(true);
    expect(passwordOk('demo@1234')).toBe(false);
    expect(passwordOk('Demo1234')).toBe(false);
    expect(passwordOk('De@1')).toBe(false);
    expect(containsEmailName('Sok.dara9', 'sok.dara@example.com')).toBe(true);
    expect(containsEmailName('Bright#2026', 'sok.dara@example.com')).toBe(false);
  });

  it('masks and normalizes Cambodian phone numbers', () => {
    expect(maskPhoneInput('012345678')).toBe('012 345 678');
    expect(maskPhoneInput('0968189261999')).toBe('096 818 9261');
    expect(normalizePhoneInput('12 345 678')).toBe('012345678');
    expect(normalizePhoneInput('+855 12 345 678')).toBe('012345678');
    expect(phoneInputOk('012345678')).toBe(true);
    expect(phoneInputOk('001234567')).toBe(false);
  });

  it('only follows same-site ?next paths', () => {
    expect(safeNextPath('/seller/orders')).toBe('/seller/orders');
    expect(safeNextPath('/kh/checkout?x=1')).toBe('/checkout?x=1');
    expect(safeNextPath('https://evil.com')).toBeNull();
    expect(safeNextPath('//evil.com')).toBeNull();
    expect(safeNextPath('/en/sign-in?step=code')).toBeNull();
    expect(safeNextPath('/sign-up?step=verify')).toBeNull();
    expect(afterSignIn('/create-business')).toBe('/create-business');
    expect(afterSignIn(null)).toBe('/home');
    expect(afterSignIn('/sign-up')).toBe('/home');
  });
});
