'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { LocationPicker } from '@/components/location/LocationPicker';
import { useAddAddress, useAddresses } from '@/features/shop-account/queries';
import { fallbackErrorKey } from '@/lib/api';
import { useSession } from '@/lib/auth';
import type { AddressLabel } from '@/lib/domain';
import type { LatLng } from '@/lib/geo';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { formatPhone, isValidPhone, normalizePhone } from '@/lib/utils/phone';
import { cn } from '@/lib/utils/cn';

import { DEMO_EMAIL, DEMO_PASSWORD, sheetSignIn, useAuthGate, useFmt, useShopData } from '../hooks';
import s from '../shop.module.css';
import { TOAST_MS } from '../rules';
import { toast, useShopStore, useShopUi } from '../store';
import type { ShopAddress } from '../types';
import { Modal, Spin } from './ui';

function Field({
  id,
  label,
  error,
  children,
  hint,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(s.field, error && s.bad)}>
      <label htmlFor={id}>{label}</label>
      {children}
      <div className={s.err} id={`${id}-err`} role={error ? 'alert' : undefined}>
        {error}
      </div>
      {hint && <span className={cn(s.tiny, s.muted)}>{hint}</span>}
    </div>
  );
}
export { Field };

/** "Log in to …" sheet, prefilled with the demo account (signs in Kry Sonita). */
export function LoginSheet() {
  const t = useTranslations('shop.login');
  const tt = useTranslations('shop.toast');
  const tc = useTranslations('common');
  const gate = useAuthGate();
  const pathname = usePathname();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const open = gate.open;

  useEffect(() => {
    if (open) {
      setEmail(DEMO_EMAIL);
      setPassword(DEMO_PASSWORD);
      setErr('');
      setBusy(false);
    }
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErr(t('wrong'));
      return;
    }
    setBusy(true);
    setErr('');
    const user = await sheetSignIn(email, password);
    if ('key' in user) {
      setBusy(false);
      setErr(
        user.key === 'locked'
          ? t('locked', { seconds: user.seconds })
          : user.key === 'network' || user.key === 'generic'
            ? tc(`errors.${user.key}`)
            : t(user.key),
      );
      return;
    }
    const then = open?.then;
    gate.close();
    toast(tt('welcome', { name: user.name.split(' ')[0] ?? user.name }));
    then?.();
  };

  return (
    <Modal open={!!open} onClose={gate.close} title={open ? t(`why.${open.why}`) : ''}>
      <p className={s.muted}>{t('body')}</p>
      <div className={cn(s.alert, s.aWarn)}>
        <span>
          {t.rich('demo', {
            link: (c) => (
              <Link
                className={s.link}
                href={{ pathname: '/sign-in', query: { next: pathname } }}
                onClick={gate.close}
              >
                {c}
              </Link>
            ),
          })}
        </span>
      </div>
      <form className={s.modalForm} noValidate onSubmit={submit}>
        <Field id="le" label={t('email')}>
          <input
            id="le"
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the prototype focuses the first field
            autoFocus
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field id="lp" label={t('password')} error={err}>
          <input
            id="lp"
            type="password"
            autoComplete="current-password"
            value={password}
            aria-invalid={!!err}
            aria-describedby="lp-err"
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <button className={cn(s.btn, s.btnPrimary, s.btnBlock)} disabled={busy}>
          {busy ? (
            <>
              <Spin />
              {t('busy')}
            </>
          ) : (
            t('submit')
          )}
        </button>
      </form>
      <p className={cn(s.small, s.muted, s.loginAlt)}>
        {t.rich('newHere', {
          link: (c) => (
            <Link
              className={s.link}
              href={{ pathname: '/sign-up', query: { next: pathname } }}
              onClick={gate.close}
            >
              {c}
            </Link>
          ),
        })}
      </p>
    </Modal>
  );
}

// ---- Address form -------------------------------------------------------------------------

interface AddressSheetState {
  open: boolean;
  after?: (a: ShopAddress) => void;
}
let openAddress: (after?: (a: ShopAddress) => void) => void = () => {};
/** Opens the "Add address" sheet (mounted once in the shop shell). */
export const addAddress = (after?: (a: ShopAddress) => void) => openAddress(after);

const LABELS: AddressLabel[] = ['HOME', 'WORK', 'OTHER'];

export function AddressSheet() {
  const t = useTranslations('shop.address');
  const tt = useTranslations('shop.toast');
  const tc = useTranslations('common');
  const f = useFmt();
  const { user } = useSession();
  const { data: addresses = [] } = useAddresses();
  const add = useAddAddress();
  const [saveErr, setSaveErr] = useState('');
  const { districts } = useShopData();
  const area = useShopStore((st) => st.area);
  const [st, setSt] = useState<AddressSheetState>({ open: false });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const form = useRef<HTMLFormElement>(null);
  // Street and district are controlled so a map pick can fill them; both stay editable.
  const [line, setLine] = useState('');
  const [district, setDistrict] = useState(area);
  const [pin, setPin] = useState<LatLng | null>(null);
  const [opened, setOpened] = useState(0);

  useEffect(() => {
    openAddress = (after) => {
      setErrs({});
      setLine('');
      setDistrict(useShopStore.getState().area);
      setPin(null);
      setSaveErr('');
      setOpened((n) => n + 1);
      setSt({ open: true, ...(after ? { after } : {}) });
    };
    return () => {
      openAddress = () => {};
    };
  }, []);

  const close = () => setSt({ open: false });
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const lineV = line.trim();
    const name = String(d.get('name') ?? '').trim();
    const phone = String(d.get('phone') ?? '').trim();
    const next: Record<string, string> = {};
    if (lineV.length < 4) next.line = t('errLine');
    if (name.length < 2) next.name = t('errName');
    if (!isValidPhone(phone)) next.phone = t('errPhone');
    setErrs(next);
    if (Object.keys(next).length) return;
    const note = String(d.get('note') ?? '').trim();
    setSaveErr('');
    let a: ShopAddress;
    try {
      a = await add.mutateAsync({
        label: String(d.get('label') ?? 'HOME') as AddressLabel,
        line: lineV,
        district,
        ...(pin ? { lat: pin.lat, lng: pin.lng } : {}),
        name,
        phone: normalizePhone(phone),
        ...(note ? { note } : {}),
        isDefault: d.get('def') === 'on' || !addresses.length,
      });
    } catch (err) {
      setSaveErr(tc(fallbackErrorKey(err)));
      return;
    }
    const after = st.after;
    close();
    after?.(a);
    toast(tt('addressSaved'));
  };

  return (
    <Modal open={st.open} onClose={close} title={t('title')}>
      <form ref={form} className={s.modalForm} noValidate onSubmit={submit}>
        <div className={s.field}>
          <span className={s.lbl}>{t('label')}</span>
          <div className={s.labelChips}>
            {LABELS.map((l, i) => (
              <label key={l} className={s.chip}>
                <input type="radio" name="label" value={l} defaultChecked={i === 0} />
                {t(`labels.${l}`)}
              </label>
            ))}
          </div>
        </div>
        <LocationPicker
          key={opened}
          value={null}
          district={district}
          onPick={(p) => {
            setPin({ lat: p.lat, lng: p.lng });
            if (p.district && districts.includes(p.district)) setDistrict(p.district);
            if (p.line) {
              setLine(p.line);
              setErrs(({ line: _l, ...rest }) => rest);
            }
          }}
        />
        <Field id="aline" label={t('line')} error={errs.line}>
          <input
            id="aline"
            name="line"
            placeholder="#12, St. 516"
            autoComplete="address-line1"
            value={line}
            onChange={(e) => setLine(e.target.value)}
          />
        </Field>
        <div className={s.field}>
          <label htmlFor="aarea">{t('district')}</label>
          <select
            id="aarea"
            name="district"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          >
            {districts.map((d) => (
              <option key={d} value={d}>
                {f.district(d)}
              </option>
            ))}
          </select>
        </div>
        <div className={s.g2}>
          <Field id="aname" label={t('receiver')} error={errs.name}>
            <input id="aname" name="name" defaultValue={user?.name ?? ''} />
          </Field>
          <Field id="aph" label={t('phone')} error={errs.phone}>
            <input
              id="aph"
              name="phone"
              inputMode="tel"
              defaultValue={user?.phone ? formatPhone(user.phone) : ''}
            />
          </Field>
        </div>
        <div className={s.field}>
          <label htmlFor="anote">{t('note')}</label>
          <input id="anote" name="note" placeholder={t('notePh')} maxLength={80} />
        </div>
        <label className={s.fopt}>
          <input type="checkbox" name="def" />
          {t('makeDefault')}
        </label>
        {saveErr && (
          <div className={cn(s.alert, s.aWarn)} role="alert">
            <span>{saveErr}</span>
          </div>
        )}
        <button className={cn(s.btn, s.btnPrimary, s.btnBlock)} disabled={add.isPending}>
          {add.isPending ? <Spin /> : null}
          {t('save')}
        </button>
      </form>
    </Modal>
  );
}

// ---- Review form --------------------------------------------------------------------------

export const QUICK_TAGS = ['quality', 'fast', 'packed', 'value', 'friendly'] as const;
export type QuickTag = (typeof QUICK_TAGS)[number];

let openReview: (itemId: string, orderNumber?: string) => void = () => {};
/** Opens "Rate …" for an item (login required by the caller); `orderNumber` = from that order. */
export const writeReview = (itemId: string, orderNumber?: string) =>
  openReview(itemId, orderNumber);
/** The review sheet (`@/features/shop-review`) registers itself here while mounted. */
export function setReviewOpener(fn: ((itemId: string, orderNumber?: string) => void) | null) {
  openReview = fn ?? (() => {});
}

// ---- Toast --------------------------------------------------------------------------------

/** Single toast with an optional link or undo action; hides after 4 s. */
export function ToastHost() {
  const toastState = useShopUi((u) => u.toast);
  const hide = useShopUi((u) => u.hideToast);
  useEffect(() => {
    if (!toastState) return;
    const id = setTimeout(hide, TOAST_MS);
    return () => clearTimeout(id);
  }, [toastState, hide]);
  if (!toastState) return null;
  const a = toastState.action;
  return (
    <div key={toastState.id} className={s.toast} role="status">
      <span>{toastState.msg}</span>
      {a &&
        (a.href ? (
          <Link href={a.href} onClick={hide}>
            {a.label}
          </Link>
        ) : (
          <button
            onClick={() => {
              hide();
              a.fn?.();
            }}
          >
            {a.label}
          </button>
        ))}
    </div>
  );
}
