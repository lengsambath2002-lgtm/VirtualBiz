import { describe, expect, it } from 'vitest';

import { csvTemplate, parseCsv } from './csv';

describe('parseCsv', () => {
  it('reads quoted cells, doubled quotes, CRLF and a BOM', () => {
    const t = parseCsv('﻿"Name","Note"\r\n"Sok ""Dara""","a, b"\r\nDavy,"line1\nline2"\r\n');
    expect(t.headers).toEqual(['Name', 'Note']);
    expect(t.rows).toEqual([
      { Name: 'Sok "Dara"', Note: 'a, b' },
      { Name: 'Davy', Note: 'line1\nline2' },
    ]);
  });

  it('takes semicolons, skips blank lines, fills short rows and undoes formula guards', () => {
    const t = parseCsv("Name;Phone;Note\n\nKim;012 345 678\n'=Pisey;'+855;x\n");
    expect(t.rows).toEqual([
      { Name: 'Kim', Phone: '012 345 678', Note: '' },
      { Name: '=Pisey', Phone: '+855', Note: 'x' },
    ]);
  });

  it('reads back its own template, Khmer included', () => {
    expect(parseCsv(csvTemplate(['ឈ្មោះ', 'Phone'], ['សុខ', '012'])).rows).toEqual([
      { ឈ្មោះ: 'សុខ', Phone: '012' },
    ]);
  });
});
