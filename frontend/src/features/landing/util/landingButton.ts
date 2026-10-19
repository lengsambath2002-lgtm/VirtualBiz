import { buttonClassName, type ButtonVariant } from '@/components/ui';

export type LandingButtonSize = 'sm' | 'md' | 'lg';

// The landing page's button metrics (48 / 38 / 56px) on top of the shared capsule Button.
const SIZE: Record<LandingButtonSize, string> = {
  sm: 'h-[38px] px-4 text-[14px]',
  md: 'h-12 px-[22px] text-[15.5px]',
  lg: 'h-14 px-7 text-[17px]',
};

// Landing differences from the shared variants: the accent gets a sheen, and buttons do not
// change colour on hover (they only press in).
const VARIANT: Partial<Record<ButtonVariant, string>> = {
  primary: 'hover:bg-primary',
  accent: 'bg-accent-sheen hover:brightness-100',
};

export function landingButton(
  variant: ButtonVariant = 'primary',
  size: LandingButtonSize = 'md',
  className?: string,
) {
  return buttonClassName({
    variant,
    className: [SIZE[size], VARIANT[variant], 'active:scale-[.97]', className]
      .filter(Boolean)
      .join(' '),
  });
}
