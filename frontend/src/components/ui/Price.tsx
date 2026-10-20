import { formatUsd, formatUsdAsKhr } from '@/lib/money';
import { cn } from '@/lib/utils/cn';

export interface PriceProps {
  /** Amount in USD. */
  usd: number;
  /** Original price, shown struck through when higher than `usd`. */
  compareAt?: number;
  /** Show "≈ N KHR" next to the price (default true). */
  showKhr?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = { sm: 'text-[13px]', md: 'text-[15px]', lg: 'text-[22px]' } as const;

/** USD price with the riel equivalent (the platform's rate, rounded to 100 riel). */
export function Price({ usd, compareAt, showKhr = true, size = 'md', className }: PriceProps) {
  const discounted = compareAt != null && compareAt > usd;
  return (
    <span className={cn('num inline-flex flex-wrap items-baseline gap-x-1.5', className)}>
      <strong className={cn('font-semibold', discounted ? 'text-danger' : 'text-ink', SIZES[size])}>
        {formatUsd(usd)}
      </strong>
      {discounted && <s className="text-[12px] text-muted">{formatUsd(compareAt)}</s>}
      {showKhr && <span className="text-[12px] text-muted">≈ {formatUsdAsKhr(usd)}</span>}
    </span>
  );
}
