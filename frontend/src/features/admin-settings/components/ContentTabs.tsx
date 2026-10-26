'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import {
  adminApi,
  useAdminAction,
  useAdminHomeBanners,
  useAdminLegal,
} from '@/features/admin-shared/api';
import { Loading, PanelError } from '@/features/admin-shared/components/ui';
import { useAct } from '@/features/admin-shared/hooks/useAct';
import { useAdminFmt } from '@/features/admin-shared/util/format';
import { legalKey, LegalText, type LegalPageKey } from '@/features/legal';
import { cx, Ic, s, Switch } from '@/features/seller-shared';
import {
  homeBannersKey,
  HomeHero,
  type HomeBanner,
  type HomeBanners,
  type Localized,
} from '@/features/shop-home';
import { ApiError } from '@/lib/api';
import { useSession } from '@/lib/auth';

import c from './settings.module.css';
import k from './content.module.css';

type Slot = 'main' | 'side1' | 'side2';
type TextKey = 'eyebrow' | 'title' | 'body' | 'cta';
const MAX: Record<TextKey, number> = { eyebrow: 40, title: 90, body: 160, cta: 30 };
const LEGAL_MAX = 30_000;

const useIsSuper = () => useSession().user?.platformRole === 'SUPER_ADMIN';

/** The field a VALIDATION_FAILED answer points at ("main.title.en"), with its message. */
function fieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError)) return {};
  return Object.fromEntries(
    e.details.filter((d) => d.field).map((d) => [d.field!, d.message ?? '']),
  );
}

function ReadOnly() {
  const t = useTranslations('admin.settings');
  return (
    <div className={c.note}>
      <Ic name="alert" size={16} />
      {t('readOnly')}
    </div>
  );
}

/** English / Khmer switch for a preview. */
function LangSwitch({ lang, set }: { lang: 'en' | 'kh'; set: (l: 'en' | 'kh') => void }) {
  const t = useTranslations('admin.content');
  return (
    <div className={k.lang} role="radiogroup" aria-label={t('previewIn')}>
      {(['en', 'kh'] as const).map((l) => (
        <button key={l} type="button" role="radio" aria-checked={lang === l} onClick={() => set(l)}>
          {t(`lang.${l}`)}
        </button>
      ))}
    </div>
  );
}

/** One text in both languages, side by side (stacked on a phone). */
function TwoLang({
  id,
  label,
  value,
  max,
  long,
  hint,
  errors,
  onChange,
}: {
  id: string;
  label: string;
  value: Localized;
  max: number;
  long?: boolean;
  hint?: ReactNode;
  errors: Record<string, string>;
  onChange: (v: Localized) => void;
}) {
  const t = useTranslations('admin.content');
  return (
    <fieldset className={k.two}>
      <legend>{label}</legend>
      {(['en', 'kh'] as const).map((l) => {
        const err = errors[`${id}.${l}`];
        const props = {
          id: `${id}-${l}`,
          value: value[l],
          maxLength: max,
          'aria-invalid': !!err,
          onChange: (e: { target: { value: string } }) =>
            onChange({ ...value, [l]: e.target.value }),
        };
        return (
          <div key={l} className={cx(s.field, err && s.bad)}>
            <label htmlFor={`${id}-${l}`}>
              {t(`lang.${l}`)}
              <span className={k.count}>
                {value[l].length}/{max}
              </span>
            </label>
            {long ? <textarea rows={2} {...props} /> : <input {...props} />}
            {err && <div className={s.err}>{err}</div>}
          </div>
        );
      })}
      {hint && <span className={s.hint}>{hint}</span>}
    </fieldset>
  );
}

// ── Homepage ─────────────────────────────────────────────────────────────────────────

/** `/admin/settings?tab=homepage`: the marketplace homepage's three banners, with a preview. */
export function HomepageTab() {
  const t = useTranslations('admin.content');
  const f = useAdminFmt();
  const isSuper = useIsSuper();
  const act = useAct();
  const qc = useQueryClient();
  const run = useAdminAction((b: HomeBanners) => adminApi.saveHomeBanners(b));
  const { data, error, refetch } = useAdminHomeBanners();
  const [form, setForm] = useState<HomeBanners | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lang, setLang] = useState<'en' | 'kh'>('en');

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (error && !data) return <PanelError error={error} retry={() => void refetch()} />;
  if (!data || !form) return <Loading />;

  const dirty = (['main', 'side1', 'side2'] as const).some(
    (slot) => JSON.stringify(form[slot]) !== JSON.stringify(data[slot]),
  );
  const setSlot = (slot: Slot, patch: Partial<HomeBanner>) =>
    setForm((x) => (x ? { ...x, [slot]: { ...x[slot], ...patch } } : x));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    setErrors({});
    await act({
      title: t('confirmBanners'),
      body: t('confirmBannersBody'),
      ok: t('save'),
      done: t('savedBanners'),
      run: async () => {
        try {
          const saved = await run.mutateAsync(form);
          await qc.invalidateQueries({ queryKey: homeBannersKey });
          return saved;
        } catch (x) {
          setErrors(fieldErrors(x));
          throw x;
        }
      },
    });
  };

  const card = (slot: Slot) => {
    const b = form[slot];
    return (
      <section key={slot} className={cx(s.panel, k.card)} aria-labelledby={`b-${slot}`}>
        <div className={cx(s.panelH, k.cardH)}>
          <div>
            <h2 id={`b-${slot}`}>{t(`slot.${slot}`)}</h2>
            <p>{t(`slotHint.${slot}`)}</p>
          </div>
          <label className={k.show}>
            {t('show')}
            <Switch
              checked={b.visible}
              onChange={(v) => setSlot(slot, { visible: v })}
              label={t('show')}
            />
          </label>
        </div>
        <div className={s.panelB}>
          <TwoLang
            id={`${slot}.eyebrow`}
            label={t('eyebrow')}
            value={b.eyebrow}
            max={MAX.eyebrow}
            errors={errors}
            onChange={(v) => setSlot(slot, { eyebrow: v })}
          />
          <TwoLang
            id={`${slot}.title`}
            label={t('titleField')}
            value={b.title}
            max={MAX.title}
            long
            errors={errors}
            onChange={(v) => setSlot(slot, { title: v })}
          />
          <TwoLang
            id={`${slot}.body`}
            label={t('body')}
            value={b.body}
            max={MAX.body}
            long
            hint={t('bodyHint')}
            errors={errors}
            onChange={(v) => setSlot(slot, { body: v })}
          />
          {slot === 'main' && (
            <TwoLang
              id={`${slot}.cta`}
              label={t('cta')}
              value={b.cta}
              max={MAX.cta}
              errors={errors}
              onChange={(v) => setSlot(slot, { cta: v })}
            />
          )}
          <div className={cx(s.field, errors[`${slot}.href`] && s.bad)}>
            <label htmlFor={`${slot}-href`}>{t('href')}</label>
            <input
              id={`${slot}-href`}
              value={b.href}
              placeholder="/deals"
              spellCheck={false}
              autoCapitalize="none"
              onChange={(e) => setSlot(slot, { href: e.target.value })}
            />
            <span className={s.hint}>{errors[`${slot}.href`] || t('hrefHint')}</span>
          </div>
        </div>
      </section>
    );
  };

  return (
    <>
      {!isSuper && <ReadOnly />}
      <section className={cx(s.panel, k.preview)} aria-label={t('preview')}>
        <div className={cx(s.panelH, k.cardH)}>
          <h2>{t('preview')}</h2>
          <LangSwitch lang={lang} set={setLang} />
        </div>
        <div className={k.previewBody} inert>
          <HomeHero banners={form} lang={lang} />
          {!form.main.visible && !form.side1.visible && !form.side2.visible && (
            <p className={s.hint}>{t('allHidden')}</p>
          )}
        </div>
      </section>
      <form onSubmit={save} noValidate>
        <fieldset disabled={!isSuper} className={k.cards}>
          {card('main')}
          {card('side1')}
          {card('side2')}
        </fieldset>
        <div className={k.bar}>
          <span>
            {data.updatedBy
              ? t('lastChanged', { name: data.updatedBy, when: f.dateTime(data.updatedAt ?? '') })
              : t('neverChanged')}
          </span>
          {isSuper && (
            <>
              <button
                type="button"
                className={cx(s.btn, s.btnGhost)}
                disabled={!dirty}
                onClick={() => {
                  setForm(data);
                  setErrors({});
                }}
              >
                {t('discard')}
              </button>
              <button type="submit" className={cx(s.btn, s.btnPrimary)} disabled={!dirty}>
                {t('save')}
              </button>
            </>
          )}
        </div>
      </form>
    </>
  );
}

// ── Legal pages ──────────────────────────────────────────────────────────────────────

/** `/admin/settings?tab=legal`: the Terms and Privacy pages in both languages, with a preview. */
export function LegalTab() {
  const t = useTranslations('admin.content');
  const tl = useTranslations('shop.legal');
  const f = useAdminFmt();
  const isSuper = useIsSuper();
  const act = useAct();
  const qc = useQueryClient();
  const [page, setPage] = useState<LegalPageKey>('terms');
  const run = useAdminAction((v: { page: LegalPageKey; en: string; kh: string }) =>
    adminApi.saveLegal(v.page, { en: v.en, kh: v.kh }),
  );
  const { data, error, refetch } = useAdminLegal(page);
  const [form, setForm] = useState({ en: '', kh: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lang, setLang] = useState<'en' | 'kh'>('en');

  useEffect(() => {
    if (data) setForm({ en: data.en, kh: data.kh });
  }, [data]);

  const dirty = !!data && (form.en !== data.en || form.kh !== data.kh);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    setErrors({});
    await act({
      title: t('confirmLegal', { page: tl(page) }),
      body: t('confirmLegalBody'),
      ok: t('save'),
      done: t('savedLegal', { page: tl(page) }),
      run: async () => {
        try {
          const saved = await run.mutateAsync({ page, ...form });
          await qc.invalidateQueries({ queryKey: legalKey(page) });
          return saved;
        } catch (x) {
          setErrors(fieldErrors(x));
          throw x;
        }
      },
    });
  };

  return (
    <>
      {!isSuper && <ReadOnly />}
      <div className={k.pages} role="tablist" aria-label={t('legalPages')}>
        {(['terms', 'privacy'] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={page === p}
            className={cx(page === p && k.on)}
            onClick={() => {
              if (dirty && !window.confirm(t('leaveUnsaved'))) return;
              setPage(p);
              setErrors({});
            }}
          >
            {tl(p)}
          </button>
        ))}
        <a
          className={cx(s.btn, s.btnGhost, s.btnSm, k.open)}
          href={`/en/${page}`}
          target="_blank"
          rel="noopener"
        >
          {t('openPage')}
        </a>
      </div>
      {error && !data ? (
        <PanelError error={error} retry={() => void refetch()} />
      ) : !data ? (
        <Loading />
      ) : (
        <div className={k.legal}>
          <form className={s.panel} onSubmit={save} noValidate>
            <fieldset disabled={!isSuper} className={k.legalFields}>
              <p className={s.hint}>{t('legalHint')}</p>
              {(['en', 'kh'] as const).map((l) => (
                <div key={l} className={cx(s.field, errors[l] && s.bad)}>
                  <label htmlFor={`legal-${l}`}>
                    {t(`lang.${l}`)}
                    <span className={k.count}>
                      {f.int(form[l].length)}/{f.int(LEGAL_MAX)}
                    </span>
                  </label>
                  <textarea
                    id={`legal-${l}`}
                    className={k.legalText}
                    value={form[l]}
                    maxLength={LEGAL_MAX}
                    aria-invalid={!!errors[l]}
                    onChange={(e) => setForm((x) => ({ ...x, [l]: e.target.value }))}
                  />
                  {errors[l] && <div className={s.err}>{errors[l]}</div>}
                  {l === 'kh' && <span className={s.hint}>{t('khHint')}</span>}
                </div>
              ))}
            </fieldset>
            <div className={k.bar}>
              <span>
                {data.updatedBy
                  ? t('lastChanged', { name: data.updatedBy, when: f.dateTime(data.updatedAt) })
                  : t('neverChanged')}
              </span>
              {isSuper && (
                <>
                  <button
                    type="button"
                    className={cx(s.btn, s.btnGhost)}
                    disabled={!dirty}
                    onClick={() => setForm({ en: data.en, kh: data.kh })}
                  >
                    {t('discard')}
                  </button>
                  <button type="submit" className={cx(s.btn, s.btnPrimary)} disabled={!dirty}>
                    {t('save')}
                  </button>
                </>
              )}
            </div>
          </form>
          <section className={cx(s.panel, k.legalPreview)} aria-label={t('preview')}>
            <div className={cx(s.panelH, k.cardH)}>
              <h2>{t('preview')}</h2>
              <LangSwitch lang={lang} set={setLang} />
            </div>
            <div className={s.panelB}>
              <LegalText text={(lang === 'kh' && form.kh.trim()) || form.en} />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
