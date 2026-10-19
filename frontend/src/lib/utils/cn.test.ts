import { describe, expect, it } from 'vitest';

import { cn } from './cn';

describe('cn', () => {
  it('keeps the sheen image alongside the primary colour', () => {
    expect(cn('bg-primary-sheen bg-primary')).toBe('bg-primary-sheen bg-primary');
  });
  it('later colour wins', () => {
    expect(cn('text-ink', 'text-muted')).toBe('text-muted');
  });
});
