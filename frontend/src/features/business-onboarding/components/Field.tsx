import type { InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

import s from './onboarding.module.css';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  id: string;
  label: string;
  value: string;
  error?: string | null;
  onValue: (value: string) => void;
}

/** One cell of an inset grouped list: label, borderless input, inline error (prototype `field()`). */
export function Field({ id, label, value, error, onValue, ...input }: FieldProps) {
  return (
    <div className={cn(s.cell, error && s.bad)} data-cell="">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={value}
        onChange={(e) => onValue(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        {...input}
      />
      <div className={s.err} id={`${id}-err`}>
        {error}
      </div>
    </div>
  );
}
