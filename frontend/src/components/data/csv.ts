/**
 * RFC 4180 CSV reading for imports: quoted cells, doubled quotes, CRLF or LF, a leading UTF-8 BOM
 * (Excel), and `;` as the separator when the header uses it (Excel in some locales).
 */
export interface CsvTable {
  headers: string[];
  /** One object per data row, keyed by header; blank lines are skipped. */
  rows: Record<string, string>[];
}

export function parseCsv(text: string): CsvTable {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const sep =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      records.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    records.push(row);
  }
  const [head = [], ...body] = records;
  const headers = head.map((h) => h.trim());
  const rows = body
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) =>
      Object.fromEntries(
        headers.map((h, i) => [h, (r[i] ?? '').trim().replace(/^'(?=[=+\-@])/, '')]),
      ),
    );
  return { headers, rows };
}

/** A one-header-row template a shop fills in (with an example row), as a CSV string with BOM. */
export function csvTemplate(headers: string[], example: string[]): string {
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return `﻿${headers.map(q).join(',')}\r\n${example.map(q).join(',')}\r\n`;
}
