'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { api, isApiError, type ApiClient, type ApiDistrict } from '@/lib/api';
import { cn } from '@/lib/utils/cn';

import { createCustomer, patchCustomer } from '../api';
import c$ from './customers.module.css';
import { Portal } from '@/components/ui/Portal';

export interface EditableCustomer {
  /** The shop's client record (`/api/clients/{id}`); empty for a new customer. */
  clientId: string;
  name: string;
  phone: string;
  email?: string;
  district?: string;
  note?: string;
}

type Field = 'name' | 'phone' | 'email' | 'district';

/**
 * Correct a customer's record (docs/api/phase14-customers-exports.md): name, phone, email,
 * district and a private note. The API checks every field; its answer is shown on the field.
 */
export function EditCustomerDialog({
  businessId,
  customer,
  onClose,
  onSaved,
}: {
  businessId: string;
  customer: EditableCustomer;
  onClose: () => void;
  onSaved: (c: ApiClient) => void;
}) {
  const t = useTranslations('customerEdit');
  const { data: districts } = useQuery({
    queryKey: ['meta', 'districts'],
    queryFn: () => api.get<ApiDistrict[]>('/meta/districts', { auth: false }),
    staleTime: 60 * 60_000,
  });
  const [f, setF] = useState({
    name: customer.name,
    phone: customer.phone,
    email: customer.email ?? '',
    district: customer.district ?? '',
    note: customer.note ?? '',
  });
  const [err, setErr] = useState<{ field?: Field; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    setErr(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const name = f.name.trim().replace(/\s+/g, ' ');
    if (name.length < 2) return setErr({ field: 'name', msg: t('errName') });
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) {
      return setErr({ field: 'email', msg: t('errEmail') });
    }
    setBusy(true);
    try {
      const input = {
        name,
        phone: f.phone.trim(),
        email: f.email.trim(),
        district: f.district,
        note: f.note.trim(),
      };
      onSaved(
        customer.clientId
          ? await patchCustomer(businessId, customer.clientId, input)
          : await createCustomer(businessId, input),
      );
      onClose();
    } catch (x) {
      setErr(
        isApiError(x, 'DUPLICATE_CLIENT')
          ? { field: 'phone', msg: t('errPhoneTaken') }
          : isApiError(x, 'INVALID_PHONE')
            ? { field: 'phone', msg: t('errPhone') }
            : isApiError(x, 'DISTRICT_NOT_FOUND')
              ? { field: 'district', msg: t('errDistrict') }
              : isApiError(x, 'VALIDATION_FAILED')
                ? { msg: t('errCheck') }
                : { msg: t('failed') },
      );
    } finally {
      setBusy(false);
    }
  };

  const fieldErr = (k: Field) =>
    err?.field === k ? (
      <p className={c$.msg} id={`ce-${k}-err`}>
        {err.msg}
      </p>
    ) : null;
  const aria = (k: Field) =>
    err?.field === k ? { 'aria-invalid': true, 'aria-describedby': `ce-${k}-err` } : {};

  return (
    <Portal>
      <div className={c$.scrim} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <form
          className={c$.dialog}
          role="dialog"
          aria-modal="true"
          aria-label={customer.clientId ? t('title', { name: customer.name }) : t('newTitle')}
          onSubmit={submit}
          noValidate
        >
          <h2>{customer.clientId ? t('title', { name: customer.name }) : t('newTitle')}</h2>
          <label className={cn(c$.field, err?.field === 'name' && c$.bad)}>
            <span>{t('name')}</span>
            <input
              value={f.name}
              maxLength={80}
              autoComplete="off"
              onChange={(e) => set('name', e.target.value)}
              {...aria('name')}
            />
            {fieldErr('name')}
          </label>
          <div className={c$.g2}>
            <label className={cn(c$.field, err?.field === 'phone' && c$.bad)}>
              <span>{t('phone')}</span>
              <input
                type="tel"
                inputMode="tel"
                value={f.phone}
                maxLength={20}
                onChange={(e) => set('phone', e.target.value)}
                {...aria('phone')}
              />
              {fieldErr('phone')}
            </label>
            <label className={cn(c$.field, err?.field === 'district' && c$.bad)}>
              <span>{t('district')}</span>
              <select
                value={f.district}
                onChange={(e) => set('district', e.target.value)}
                {...aria('district')}
              >
                <option value="">{t('noDistrict')}</option>
                {f.district && !districts?.some((d) => d.name === f.district) && (
                  <option value={f.district}>{f.district}</option>
                )}
                {districts?.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
              {fieldErr('district')}
            </label>
          </div>
          <label className={cn(c$.field, err?.field === 'email' && c$.bad)}>
            <span>{t('email')}</span>
            <input
              type="email"
              value={f.email}
              maxLength={254}
              onChange={(e) => set('email', e.target.value)}
              {...aria('email')}
            />
            {fieldErr('email')}
          </label>
          <label className={c$.field}>
            <span>{t('note')}</span>
            <textarea
              rows={3}
              maxLength={500}
              value={f.note}
              placeholder={t('notePh')}
              onChange={(e) => set('note', e.target.value)}
            />
          </label>
          {err && !err.field && (
            <p className={c$.msg} role="alert">
              {err.msg}
            </p>
          )}
          <div className={c$.btns}>
            <button type="button" className={c$.ghost} onClick={onClose}>
              {t('cancel')}
            </button>
            <button type="submit" className={c$.primary} disabled={busy}>
              {busy ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </Portal>
  );
}
