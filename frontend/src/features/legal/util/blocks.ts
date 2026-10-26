/** A legal page's text as blocks: "## " starts a heading, "- " a bullet, a blank line a paragraph. */
export type LegalBlock =
  | { kind: 'h'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] };

export function legalBlocks(text: string): LegalBlock[] {
  const out: LegalBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ kind: 'p', text: para.join(' ') });
    para = [];
  };
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
    } else if (line.startsWith('## ')) {
      flush();
      out.push({ kind: 'h', text: line.slice(3).trim() });
    } else if (/^[-•] /.test(line)) {
      flush();
      const last = out[out.length - 1];
      if (last?.kind === 'ul') last.items.push(line.slice(2).trim());
      else out.push({ kind: 'ul', items: [line.slice(2).trim()] });
    } else {
      para.push(line);
    }
  }
  flush();
  return out;
}
