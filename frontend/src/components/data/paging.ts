/** Rows-per-page choices of every list. */
export const PAGE_SIZES = [10, 20, 50, 100] as const;

/** Page numbers to show: first, last, and two either side of the current one, with gaps. */
export function pageItems(page: number, pages: number): (number | 'gap')[] {
  const out: (number | 'gap')[] = [];
  for (let i = 0; i < pages; i++) {
    if (i === 0 || i === pages - 1 || Math.abs(i - page) <= 2) out.push(i);
    else if (out[out.length - 1] !== 'gap') out.push('gap');
  }
  return out;
}
