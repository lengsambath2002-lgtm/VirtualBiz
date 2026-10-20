'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

import { useUi, type ConfirmField, type ConfirmSpec, type ConfirmValues } from '../store/uiStore';
import { cx, Modal, s, SwitchRow } from './ui';

/** Prototype `confirmBox`: title, body, optional fields, Cancel + confirm. */
export function ConfirmDialog({
  spec,
  resolve,
}: {
  spec: ConfirmSpec;
  resolve: (v: ConfirmValues | null) => void;
}) {
  const t = useTranslations('seller.common');
  const close = useUi((u) => u.close);
  const uid = useId();
  const flat = (spec.fields ?? []).flat();
  const [values, setValues] = useState<ConfirmValues>(() =>
    Object.fromEntries(
      flat.map((f) => [
        f.key,
        f.type === 'switch'
          ? f.value
          : (f.value ?? (f.type === 'select' ? (f.options[0]?.value ?? '') : '')),
      ]),
    ),
  );
  const set = (k: string, v: string | boolean) => setValues((x) => ({ ...x, [k]: v }));

  const field = (f: ConfirmField) => {
    const id = `${uid}-${f.key}`;
    if (f.type === 'switch')
      return (
        <SwitchRow
          key={f.key}
          title={f.label}
          hint={f.hint}
          checked={!!values[f.key]}
          onChange={(v) => set(f.key, v)}
        />
      );
    if (f.type === 'select')
      return (
        <div key={f.key} className={s.field}>
          <label htmlFor={id}>{f.label}</label>
          <select
            id={id}
            value={String(values[f.key])}
            onChange={(e) => set(f.key, e.target.value)}
          >
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    return (
      <div key={f.key} className={s.field}>
        <label htmlFor={id}>{f.label}</label>
        <input
          id={id}
          value={String(values[f.key])}
          placeholder={f.placeholder}
          inputMode={f.inputMode}
          list={f.list ? `${id}-list` : undefined}
          onChange={(e) => set(f.key, e.target.value)}
        />
        {f.list && (
          <datalist id={`${id}-list`}>
            {f.list.map((o) => (
              <option key={o.value + o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </datalist>
        )}
      </div>
    );
  };

  return (
    <Modal>
      <h2>{spec.title}</h2>
      {spec.body && (
        <p className={s.muted} style={{ whiteSpace: 'pre-line' }}>
          {spec.body}
        </p>
      )}
      {(spec.fields ?? []).map((f, i) =>
        Array.isArray(f) ? (
          <div key={i} className={s.g2}>
            {f.map(field)}
          </div>
        ) : (
          field(f)
        ),
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button
          type="button"
          className={cx(s.btn, s.btnGhost)}
          onClick={() => {
            resolve(null);
            close();
          }}
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          className={cx(s.btn, spec.danger ? s.btnDanger : s.btnPrimary)}
          onClick={() => {
            resolve(values);
            close(true);
          }}
        >
          {spec.ok}
        </button>
      </div>
    </Modal>
  );
}
