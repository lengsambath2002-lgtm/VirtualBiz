import { cn } from '@/lib/utils/cn';

export interface LogoProps {
  /** Hide the wordmark and show only the mark. */
  markOnly?: boolean;
  /** `marketing` = the landing page's 34px mark + 20px wordmark. */
  size?: 'sm' | 'md' | 'lg' | 'marketing';
  className?: string;
}

const MARK = {
  sm: 'size-7 rounded-[8px]',
  md: 'size-8 rounded-[9px]',
  lg: 'size-[38px] rounded-[10px]',
  marketing: 'size-[34px] rounded-[10px]',
} as const;
const WORD = {
  sm: 'text-[16px]',
  md: 'text-[19px]',
  lg: 'text-[22px]',
  marketing: 'text-[20px]',
} as const;

/**
 * The VirtualBiz glyph: a shop awning over a "V" (docs/ui/brand.md). Drawn in `currentColor` and
 * filling its box, so the tile around it (yellow, or the console's purple) sets size and colour.
 */
export function LogoGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn('size-full', className)}>
      <path
        fill="currentColor"
        d="M13 16a3 3 0 0 1 3-3h32a3 3 0 0 1 3 3v8a6.33 6.33 0 0 1-12.67 0a6.33 6.33 0 0 1-12.66 0A6.33 6.33 0 0 1 13 24z"
      />
      <path
        d="M20.5 36.5 32 51l11.5-14.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The yellow tile with the shop glyph + the Virtual**Biz** wordmark. */
export function Logo({ markOnly = false, size = 'md', className }: LogoProps) {
  return (
    <span className={cn('inline-flex flex-none items-center gap-2 font-bold text-ink', className)}>
      <span aria-hidden="true" className={cn('flex-none bg-accent text-[#141a2b]', MARK[size])}>
        <LogoGlyph />
      </span>
      {markOnly ? (
        <span className="sr-only">VirtualBiz</span>
      ) : (
        <span className={WORD[size]}>
          Virtual<b className="text-accent-ink">Biz</b>
        </span>
      )}
    </span>
  );
}
