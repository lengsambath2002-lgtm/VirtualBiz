import { describe, expect, it } from 'vitest';

import { formatPhone, isValidPhone, normalizePhone } from './phone';

describe('normalizePhone', () => {
  it('strips formatting', () => {
    expect(normalizePhone('012 345 678')).toBe('012345678');
    expect(normalizePhone('096-818-9261')).toBe('0968189261');
  });
  it('converts +855 and 855 to a leading 0', () => {
    expect(normalizePhone('+855 12 345 678')).toBe('012345678');
    expect(normalizePhone('85512345678')).toBe('012345678');
    expect(normalizePhone('+855 96 818 9261')).toBe('0968189261');
    expect(normalizePhone('+855 012 345 678')).toBe('012345678');
  });
});

describe('isValidPhone', () => {
  it('accepts 9- and 10-digit numbers starting 0[1-9]', () => {
    expect(isValidPhone('012345678')).toBe(true);
    expect(isValidPhone('0968189261')).toBe(true);
    expect(isValidPhone('+85512345678')).toBe(true);
  });
  it('rejects bad numbers', () => {
    expect(isValidPhone('0012345678')).toBe(false); // 0 after the leading 0
    expect(isValidPhone('01234567')).toBe(false); // too short
    expect(isValidPhone('01234567890')).toBe(false); // too long
    expect(isValidPhone('12345678')).toBe(false); // no leading 0
    expect(isValidPhone('')).toBe(false);
  });
});

describe('formatPhone', () => {
  it('groups digits', () => {
    expect(formatPhone('012345678')).toBe('012 345 678');
    expect(formatPhone('+855968189261')).toBe('096 818 9261');
  });
  it('returns invalid input unchanged', () => {
    expect(formatPhone('abc')).toBe('abc');
  });
});
