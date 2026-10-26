'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils/cn';

import { useFlowActions } from '../hooks/useFlowActions';
import type { Step } from '../types';
import { emailTypo, PASSWORD_RULES } from '../util/rules';
import { SiIcon } from './icons';
import s from './signIn.module.css';

/** The page shell element: fixed overlays (modals) portal here, outside the blurred card. */
export const ShellContext = createContext<HTMLElement | null>(null);
export const useShellElement = () => useContext(ShellContext);

export function Spinner() {
  return <span className={s.spin} aria-hidden="true" />;
}

/** Capsule button that swaps to a spinner + busy label while working (the prototype's `busy()`). */
export function Btn({
  variant = 'primary',
  busy,
  busyLabel,
  className,
  children,
  disabled,
  ...rest
}: ComponentProps<'button'> & {
  variant?: 'primary' | 'ghost' | 'danger';
  busy?: boolean;
  busyLabel?: string;
}) {
  const t = useTranslations('auth.ui');
  const v = { primary: s.btnPrimary, ghost: s.btnGhost, danger: s.btnDanger }[variant];
  return (
    <button className={cn(s.btn, v, className)} disabled={busy || disabled} {...rest}>
      {busy ? (
        <>
          <Spinner />
          <span>{busyLabel ?? t('pleaseWait')}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function ErrorLine({ id, message }: { id: string; message?: ReactNode }) {
  return (
    <div className={s.err} id={id} role="alert">
      {message ? (
        <>
          <SiIcon name="alert" size={15} />
          <span>{message}</span>
        </>
      ) : null}
    </div>
  );
}

interface FieldProps {
  id: string;
  label: ReactNode;
  error?: ReactNode;
  /** Shown at the right of the label row (e.g. "Forgot password?"). */
  right?: ReactNode;
  /** Rendered under the input (hints, password rules). */
  after?: ReactNode;
  /** Rendered before the input inside the control (e.g. the +855 prefix). */
  prefix?: ReactNode;
  password?: boolean;
  input: ComponentProps<'input'>;
}

/** Label + input + error line (the prototype's `field()`), with a show/hide eye for passwords. */
export function Field({ id, label, error, right, after, prefix, password, input }: FieldProps) {
  const t = useTranslations('auth.ui');
  const [shown, setShown] = useState(false);
  const labelEl = <label htmlFor={id}>{label}</label>;
  return (
    <div className={s.field}>
      {right ? (
        <div className={s.rowL}>
          {labelEl}
          {right}
        </div>
      ) : (
        labelEl
      )}
      <div className={cn(s.ctl, password && s.ctlPw)}>
        {prefix}
        <input
          id={id}
          className={s.input}
          aria-describedby={`e-${id}`}
          aria-invalid={error ? true : undefined}
          {...input}
          type={password ? (shown ? 'text' : 'password') : (input.type ?? 'text')}
        />
        {password && (
          <button
            type="button"
            className={s.eye}
            aria-label={shown ? t('hidePassword') : t('showPassword')}
            onClick={() => setShown((v) => !v)}
          >
            <SiIcon name={shown ? 'eyeOff' : 'eye'} size={20} />
          </button>
        )}
      </div>
      {after}
      <ErrorLine id={`e-${id}`} message={error} />
    </div>
  );
}

/** The four password rules, ticking green as they're met. */
export function RulesList({ value }: { value: string }) {
  const t = useTranslations('auth.rules');
  return (
    <ul className={s.rules}>
      {PASSWORD_RULES.map(([key, test]) => (
        <li key={key} className={cn(test(value) && s.ruleOk)}>
          {t(key)}
        </li>
      ))}
    </ul>
  );
}

/** "Back" link at the top of a step. */
export function BackLink({ to }: { to: Step }) {
  const t = useTranslations('auth.ui');
  const { go } = useFlowActions();
  return (
    <button type="button" className={cn(s.link, s.quiet, s.backLink)} onClick={() => go(to)}>
      <SiIcon name="back" size={16} />
      {t('back')}
    </button>
  );
}

/** Email field with a "Did you mean …?" fix for common domain typos (gmial.com → gmail.com). */
export function EmailField({
  value,
  onChange,
  error,
  inputRef,
  autoComplete = 'username',
}: {
  value: string;
  onChange: (v: string) => void;
  error?: ReactNode;
  inputRef?: RefObject<HTMLInputElement | null>;
  autoComplete?: string;
}) {
  const t = useTranslations('auth.email');
  const [fix, setFix] = useState<string | null>(null);
  return (
    <Field
      id="email"
      label={t('label')}
      error={error}
      input={{
        ref: inputRef,
        type: 'email',
        autoComplete,
        placeholder: t('placeholder'),
        autoCapitalize: 'none',
        spellCheck: false,
        value,
        onChange: (e) => {
          onChange(e.target.value);
          if (fix) setFix(null);
        },
        onBlur: () => setFix(emailTypo(value.trim())),
      }}
      after={
        fix ? (
          <div className={s.hint}>
            {t.rich('didYouMean', {
              email: fix,
              fix: (chunks) => (
                <button
                  type="button"
                  className={s.link}
                  onClick={() => {
                    onChange(fix);
                    setFix(null);
                    inputRef?.current?.focus();
                  }}
                >
                  {chunks}
                </button>
              ),
            })}
          </div>
        ) : null
      }
    />
  );
}

/** Link to one of the static footer steps (Help, Terms, Privacy). */
export function StepLink({ step, children }: { step: Step; children: ReactNode }) {
  const { go } = useFlowActions();
  return (
    <a
      href={`?step=${step}`}
      onClick={(e) => {
        e.preventDefault();
        go(step);
      }}
    >
      {children}
    </a>
  );
}

/**
 * Terms or Privacy, in a new tab: the page being filled in (a half-typed sign-up) stays as it is.
 */
export function LegalLink({ page, children }: { page: 'terms' | 'privacy'; children: ReactNode }) {
  const locale = useLocale();
  return (
    <a href={`/${locale}/${page}`} target="_blank" rel="noopener">
      {children}
    </a>
  );
}

/** Bottom line of a page's first step: "New to VirtualBiz? Create an account" and back. */
export function AltLine({ children }: { children: ReactNode }) {
  return <p className={s.alt}>{children}</p>;
}

/**
 * Bottom sheet / dialog over the card (the Google account chooser). Portals into the page
 * shell, closes on Escape and on the scrim, and keeps focus inside while open.
 */
export function Sheet({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const shell = useShellElement();
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const el = box.current;
    // A form field gets focus; otherwise the dialog itself, so no option looks pre-selected.
    (el?.querySelector<HTMLElement>('input') ?? el)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
      if (e.key !== 'Tab' || !el) return;
      const items = el.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href]');
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (!shell) return null;
  return createPortal(
    <div
      className={s.scrim}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={s.modal}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        ref={box}
      >
        {children}
      </div>
    </div>,
    shell,
  );
}

export function Alert({ kind, children }: { kind: 'bad' | 'ok'; children: ReactNode }) {
  return (
    <div
      className={cn(s.alert, kind === 'bad' ? s.aBad : s.aOk)}
      role={kind === 'bad' ? 'alert' : 'status'}
    >
      <SiIcon name={kind === 'bad' ? 'alert' : 'check'} size={16} />
      <span>{children}</span>
    </div>
  );
}

export function OrDivider() {
  const t = useTranslations('auth.ui');
  return <div className={s.or}>{t('or')}</div>;
}
