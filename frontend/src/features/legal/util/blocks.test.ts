import { describe, expect, it } from 'vitest';

import { legalBlocks } from './blocks';

describe('legalBlocks', () => {
  it('reads headings, bullets and paragraphs', () => {
    expect(
      legalBlocks(
        'Intro line one\nand two.\n\n## Your account\n- Real name\n- Keep it safe\nAfter.\r\n',
      ),
    ).toEqual([
      { kind: 'p', text: 'Intro line one and two.' },
      { kind: 'h', text: 'Your account' },
      { kind: 'ul', items: ['Real name', 'Keep it safe'] },
      { kind: 'p', text: 'After.' },
    ]);
  });

  it('ignores blank text', () => {
    expect(legalBlocks('  \n\n ')).toEqual([]);
  });
});
