import { cn } from '@/lib/utils/cn';

export interface LogoProps {
  /** Hide the wordmark and show only the "B" mark. */
  markOnly?: boolean;
  /** `marketing` = the landing page's 34px mark + 20px wordmark. */
  size?: 'sm' | 'md' | 'lg' | 'marketing';
  className?: string;
}

const MARK = {
  sm: 'size-7 text-[15px]',
  md: 'size-8 text-[17px]',
  lg: 'size-[38px] text-[19px]',
  marketing: 'size-[34px] rounded-[10px] text-[18px]',
} as const;
const WORD = {
  sm: 'text-[16px]',
  md: 'text-[19px]',
  lg: 'text-[22px]',
  marketing: 'text-[20px]',
} as const;

/** Yellow rounded "B" mark + the Virtual**Biz** wordmark. */
export function Logo({ markOnly = false, size = 'md', className }: LogoProps) {
  return (
    <span className={cn('inline-flex flex-none items-center gap-2 font-bold text-ink', className)}>
      <span
        aria-hidden="true"
        className={cn('grid place-items-center rounded-sm bg-accent text-accent-on', MARK[size])}
      >
        B
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
