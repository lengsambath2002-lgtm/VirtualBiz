import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

export type ButtonVariant = 'primary' | 'accent' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary-sheen bg-primary text-primary-on shadow-button hover:bg-primary-hover',
  accent: 'bg-accent text-accent-on shadow-button hover:brightness-105',
  ghost: 'glass text-ink hover:bg-glass-strong',
  danger: 'bg-danger text-white shadow-button hover:brightness-110',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-[34px] px-3 text-[13px]',
  md: 'h-11 px-[18px]',
  lg: 'h-[52px] px-[18px] text-[15px]',
};

export interface ButtonClassOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
}

/**
 * The capsule button classes, for elements that must look like a Button but aren't a
 * <button> (e.g. a locale-aware <Link>). `className` is merged last, so it can override.
 */
export function buttonClassName({
  variant = 'primary',
  size = 'md',
  block,
  className,
}: ButtonClassOptions = {}) {
  return cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-capsule font-semibold tracking-[-.01em]',
    'transition-[transform,background-color,box-shadow] duration-150 enabled:active:scale-[.97]',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    block && 'w-full',
    className,
  );
}

/** Capsule button (glass layer `.btn`). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClassName({ variant, size, block, className })}
      {...rest}
    />
  );
});
