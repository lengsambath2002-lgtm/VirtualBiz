'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import {
  cx,
  Ic,
  s,
  stockOf,
  useDb,
  useFmt,
  useGo,
  useSellerStore,
  useUi,
  type DraftVariant,
  type ProductDraft,
  type SellerProduct,
  useCollectionName,
} from '@/features/seller-shared';
import { Link, useRouter } from '@/lib/i18n/navigation';
import {
  IMAGE_ACCEPT,
  IMAGE_TYPES,
  imageErrorKey,
  isApiError,
  MAX_IMAGE_BYTES,
  uploadImage,
} from '@/lib/api';

const rid = () => Math.random().toString(36).slice(2, 8);
const newVariant = (base?: Partial<DraftVariant>): DraftVariant => ({
  id: `new-${rid()}`,
  options: {},
  price: base?.price ?? '',
  compareAt: base?.compareAt ?? '',
  cost: base?.cost ?? '',
  sku: '',
  barcode: '',
  stock: 0,
});

function blank(lowStockAt: number): ProductDraft {
  return {
    id: null,
    title: '',
    collection: '',
    status: 'DRAFT',
    description: '',
    lowStockAt,
    options: [],
    variants: [newVariant()],
    photos: [],
    sold: 0,
    rating: 0,
  };
}

function fromProduct(p: SellerProduct): ProductDraft {
  return {
    id: p.id,
    title: p.title,
    collection: p.collection,
    status: p.status,
    description: p.description,
    lowStockAt: p.lowStockAt,
    options: p.options.map((o) => ({ name: o.name, values: [...o.values] })),
    variants: p.variants.map((v) => ({
      id: v.id,
      options: { ...v.options },
      price: String(v.price),
      compareAt: v.compareAt ? String(v.compareAt) : '',
      cost: v.cost ? String(v.cost) : '',
      sku: v.sku,
      barcode: v.barcode,
      stock: v.stock,
    })),
    photos: [...p.photos],
    sold: p.sold,
    rating: p.rating,
  };
}

/** Rebuild the variant matrix from the options, keeping existing variants (prototype). */
function regenVariants(d: ProductDraft): ProductDraft {
  const opts = d.options.filter((o) => o.name && o.values.length);
  if (!opts.length) {
    const keep = d.variants[0];
    return {
      ...d,
      variants: [
        {
          ...newVariant(keep),
          id: keep?.id ?? newVariant().id,
          sku: keep?.sku ?? '',
          barcode: keep?.barcode ?? '',
          stock: keep?.stock ?? 0,
        },
      ],
    };
  }
  let combos: Record<string, string>[] = [{}];
  opts.forEach((o) => {
    combos = combos.flatMap((c) => o.values.map((v) => ({ ...c, [o.name]: v })));
  });
  const base = d.variants[0];
  return {
    ...d,
    variants: combos.map((c) => {
      const ex = d.variants.find((v) => opts.every((o) => v.options[o.name] === c[o.name]));
      return ex ? { ...ex, options: c } : { ...newVariant(base), options: c };
    }),
  };
}

type Errs = Record<string, string>;

export function ProductEditor({ id }: { id: string }) {
  const t = useTranslations('seller.editor');
  const tc = useTranslations('common');
  const [uploading, setUploading] = useState(0);
  const tcol = useCollectionName();
  const db = useDb();
  const f = useFmt();
  const go = useGo();
  const router = useRouter();
  const isNew = id === 'new';
  const src = isNew ? null : (db.products.find((p) => p.id === id) ?? null);
  const [draft, setDraft] = useState<ProductDraft>(() =>
    src ? fromProduct(src) : blank(db.shop.lowStockDefault),
  );
  const [dirty, setDirtyState] = useState(false);
  const [errs, setErrs] = useState<Errs>({});
  const [bad, setBad] = useState<Set<string>>(new Set());
  const [over, setOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  /** Option whose value field gets focus after the next render ("Add option"). */
  const focusOpt = useRef<number | null>(null);
  useEffect(() => {
    if (focusOpt.current === null) return;
    formRef.current
      ?.querySelector<HTMLInputElement>(`[data-addval="${focusOpt.current}"]`)
      ?.focus();
    focusOpt.current = null;
  });
  const toast = useUi((u) => u.showToast);

  const setDirty = useCallback((v: boolean) => {
    setDirtyState(v);
    useUi.getState().setEditorDirty(v);
  }, []);
  useEffect(() => () => useUi.getState().setEditorDirty(false), []);

  const edit = (fn: (d: ProductDraft) => ProductDraft, clear?: string) => {
    setDraft(fn);
    setDirty(true);
    if (clear) {
      setErrs((e) => (e[clear] ? { ...e, [clear]: '' } : e));
      setBad((b) => {
        if (!b.has(clear)) return b;
        const n = new Set(b);
        n.delete(clear);
        return n;
      });
    }
  };
  const setVar = (i: number, k: keyof DraftVariant, raw: string) => {
    const val =
      k === 'price' || k === 'compareAt' || k === 'cost'
        ? raw.replace(/[^\d.]/g, '')
        : k === 'stock'
          ? +raw.replace(/\D/g, '') || 0
          : raw.trim();
    edit(
      (d) => ({ ...d, variants: d.variants.map((v, j) => (j === i ? { ...v, [k]: val } : v)) }),
      `v${i}${k === 'compareAt' ? 'compare' : k}`,
    );
  };

  const save = useCallback(async () => {
    const d = draft;
    const e: Errs = {};
    const b = new Set<string>();
    let n = 0;
    if (d.title.trim().length < 2) {
      e.title = t('err.title');
      n++;
    }
    if (!d.collection) {
      e.cat = t('err.cat');
      n++;
    }
    if (d.options.some((o) => !o.name.trim() || !o.values.length)) {
      e.opts = t('err.opts');
      n++;
    }
    const names = d.options.map((o) => o.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      e.opts = t('err.optsDup');
      n++;
    }
    const others = db.products.filter((p) => p.id !== d.id);
    const allSkus = others.flatMap((p) => p.variants.map((v) => v.sku).filter(Boolean));
    const allBc = others.flatMap((p) => p.variants.map((v) => v.barcode).filter(Boolean));
    let varErr = false;
    d.variants.forEach((v, i) => {
      const pe = !(parseFloat(v.price) > 0)
        ? t('err.price')
        : v.compareAt && parseFloat(v.compareAt) <= parseFloat(v.price)
          ? t('err.compare')
          : '';
      if (pe) {
        n++;
        varErr = true;
        e[`v${i}price`] = pe;
        b.add(`v${i}price`);
        if (!d.options.length && pe === t('err.compare')) {
          e.v0compare = pe;
          b.add('v0compare');
        }
      }
      if (
        v.sku &&
        (allSkus.includes(v.sku) || d.variants.some((x, j) => j !== i && x.sku === v.sku))
      ) {
        n++;
        varErr = true;
        e[`v${i}sku`] = t('err.sku');
        b.add(`v${i}sku`);
      }
      if (
        v.barcode &&
        (allBc.includes(v.barcode) || d.variants.some((x, j) => j !== i && x.barcode === v.barcode))
      ) {
        n++;
        varErr = true;
        e[`v${i}barcode`] = t('err.barcode');
        b.add(`v${i}barcode`);
      }
    });
    if (varErr) e.vars = t('err.vars');
    if (e.title) b.add('title');
    if (e.cat) b.add('cat');
    setErrs(e);
    setBad(b);
    if (n) {
      toast(t('fixN', { n }));
      requestAnimationFrame(() => {
        formRef.current
          ?.querySelector<HTMLElement>('[data-bad="true"] input,[data-bad="true"] select')
          ?.focus();
      });
      return;
    }
    if (saving) return;
    setSaving(true);
    let newId: string;
    try {
      newId = await useSellerStore.getState().saveProduct(d);
    } catch (err) {
      // The server checks SKU / barcode across the whole shop (field: variants[i].sku).
      const field = isApiError(err, 'DUPLICATE_SKU', 'DUPLICATE_BARCODE')
        ? err.details[0]?.field?.match(/^variants\[(\d+)\]\.(sku|barcode)$/)
        : null;
      if (field) {
        const k = `v${field[1]}${field[2]}`;
        const msg = t(field[2] === 'sku' ? 'err.sku' : 'err.barcode');
        setErrs((x) => ({ ...x, [k]: msg, vars: t('err.vars') }));
        setBad((x) => new Set(x).add(k));
        toast(t('fixN', { n: 1 }));
      } else toast(t('saveFailed'));
      return;
    } finally {
      setSaving(false);
    }
    setDirty(false);
    if (!d.id) {
      router.push(`/seller/products/${newId}`);
      toast(
        d.status === 'ACTIVE' ? t('live', { title: d.title }) : t('savedDraft', { title: d.title }),
      );
    } else {
      const fresh = useSellerStore.getState().db?.products.find((p) => p.id === newId);
      if (fresh) setDraft(fromProduct(fresh));
      toast(t('saved'));
    }
  }, [draft, db.products, router, setDirty, t, toast, saving]);

  // Ctrl/⌘+S saves; closing the tab with unsaved changes asks first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (useUi.getState().editorDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [save]);

  if (!isNew && !src)
    return (
      <div className={s.empty}>
        <strong>{t('notFound')}</strong>
        <Link className={cx(s.btn, s.btnGhost, s.btnSm)} href="/seller/products">
          {t('backToProducts')}
        </Link>
      </div>
    );

  const d = draft;
  const single = !d.options.length;
  const v0 = d.variants[0]!;
  const margin = (v: DraftVariant) => {
    const p = parseFloat(v.price);
    const c = parseFloat(v.cost);
    return p > 0 && c > 0
      ? t('margin', { pct: Math.round(((p - c) / p) * 100), profit: f.money(p - c) })
      : t('marginHidden');
  };
  const isBad = (k: string) => bad.has(k) || !!errs[k];
  const fieldCls = (k: string) => cx(s.field, isBad(k) && s.bad);

  // Each photo is uploaded (`POST /api/files`); the product keeps its `/api/files/{id}` URL.
  const addPhotos = (files: FileList | null) => {
    [...(files ?? [])].slice(0, 8).forEach((file) => {
      if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return toast(t('photoType'));
      if (file.size > MAX_IMAGE_BYTES) return toast(t('photoSize', { name: file.name }));
      setUploading((n) => n + 1);
      uploadImage(file, 'PRODUCT_PHOTO')
        .then((up) => edit((x) => ({ ...x, photos: [...x.photos, up.url] })))
        .catch((e: unknown) => toast(tc(imageErrorKey(e))))
        .finally(() => setUploading((n) => n - 1));
    });
  };

  const addValue = (oi: number, raw: string) => {
    const val = raw.trim().replace(/,$/, '');
    if (!val) return false;
    const op = d.options[oi];
    if (!op) return false;
    if (op.values.some((x) => x.toLowerCase() === val.toLowerCase())) {
      toast(t('dupValue', { v: val }));
      return false;
    }
    edit((x) =>
      regenVariants({
        ...x,
        options: x.options.map((o, j) => (j === oi ? { ...o, values: [...o.values, val] } : o)),
      }),
    );
    return true;
  };

  const duplicate = () => {
    if (!src) return;
    void useSellerStore
      .getState()
      .duplicateProduct(src.id)
      .then((nid) => go(`/seller/products/${nid}`))
      .then((ok) => ok && toast(t('duplicated')))
      .catch(() => toast(t('saveFailed')));
  };

  const remove = async () => {
    if (!src) return;
    const ui = useUi.getState();
    const open = db.orders.filter(
      (o) =>
        ['NEW', 'ACCEPTED', 'PACKED', 'SHIPPED'].includes(o.status) &&
        o.lines.some((l) => src.variants.some((v) => v.id === l.variantId)),
    ).length;
    if (open) {
      const ok = await ui.confirm({
        title: t('inOpenOrders', { title: src.title, n: open }),
        body: t('inOpenOrdersBody'),
        ok: t('setDraft'),
      });
      if (ok) {
        try {
          await useSellerStore.getState().setProductDraft(src.id);
        } catch {
          toast(t('saveFailed'));
          return;
        }
        setDraft((x) => ({ ...x, status: 'DRAFT' }));
        setDirty(false);
        toast(t('setToDraft'));
      }
      return;
    }
    const ok = await ui.confirm({
      title: t('deleteTitle', { title: src.title }),
      body: t('deleteBody'),
      ok: t('deleteOk'),
      danger: true,
    });
    if (ok) {
      try {
        await useSellerStore.getState().deleteProduct(src.id);
      } catch {
        toast(t('saveFailed'));
        return;
      }
      setDirty(false);
      router.push('/seller/products');
      toast(t('deleted'));
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void save();
  };

  const adjust = (variantId: string) => useUi.getState().open({ kind: 'adjust', variantId });
  const liveStock = (variantId: string) =>
    src?.variants.find((v) => v.id === variantId)?.stock ?? 0;

  return (
    <>
      {dirty && (
        <div className={s.savebar}>
          <span>
            <Ic name="alert" size={16} /> {t('unsaved')}
          </span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={cx(s.btn, s.btnGhost, s.btnSm)}
              onClick={() => {
                setDraft(src ? fromProduct(src) : blank(db.shop.lowStockDefault));
                setErrs({});
                setBad(new Set());
                setDirty(false);
                toast(t('discarded'));
              }}
            >
              {t('discard')}
            </button>
            <button
              type="button"
              className={cx(s.btn, s.btnAccent, s.btnSm)}
              onClick={() => void save()}
            >
              {t('save')}
            </button>
          </span>
        </div>
      )}
      <div className={s.phH}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link className={s.ibtn} href="/seller/products" aria-label={t('backToProducts')}>
            <Ic name="left" />
          </Link>
          <h1>{isNew ? t('addTitle') : src?.title}</h1>
          {src && (
            <span className={cx(s.pill, src.status === 'ACTIVE' ? s.ok : s.neutral)}>
              {t(src.status === 'ACTIVE' ? 'active' : 'draft')}
            </span>
          )}
        </div>
        {src && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className={cx(s.btn, s.btnGhost, s.btnSm)} onClick={duplicate}>
              {t('duplicate')}
            </button>
            <button
              type="button"
              className={cx(s.btn, s.btnGhost, s.btnSm, s.dangerText)}
              onClick={() => void remove()}
            >
              <Ic name="trash" size={16} />
              {t('delete')}
            </button>
          </div>
        )}
      </div>
      <form ref={formRef} className={s.ed} noValidate onSubmit={submit}>
        <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
          <section className={s.panel}>
            <div className={s.panelB}>
              <div className={fieldCls('title')} data-bad={isBad('title')}>
                <label htmlFor="pe-title">{t('titleLabel')}</label>
                <input
                  id="pe-title"
                  value={d.title}
                  maxLength={80}
                  placeholder={t('titlePh')}
                  onChange={(e) => {
                    const v = e.target.value;
                    edit((x) => ({ ...x, title: v }), 'title');
                  }}
                />
                <div className={s.err}>{errs.title}</div>
              </div>
              <div className={s.field}>
                <label htmlFor="pe-desc">{t('desc')}</label>
                <textarea
                  id="pe-desc"
                  rows={4}
                  maxLength={1000}
                  placeholder={t('descPh')}
                  value={d.description}
                  onChange={(e) => {
                    const v = e.target.value;
                    edit((x) => ({ ...x, description: v }));
                  }}
                />
              </div>
            </div>
          </section>
          <section className={s.panel}>
            <div className={s.panelH}>
              <h2>{t('photos')}</h2>
              <span className={s.hint}>{t('photosHint')}</span>
            </div>
            <div className={s.panelB}>
              <div className={s.media}>
                {d.photos.map((ph, i) => (
                  <div key={i} className={s.mediaItem} style={{ backgroundImage: `url(${ph})` }}>
                    {i === 0 && <span className={s.mediaCover}>{t('cover')}</span>}
                    <button
                      type="button"
                      aria-label={t('removePhoto', { n: i + 1 })}
                      onClick={() =>
                        edit((x) => ({ ...x, photos: x.photos.filter((_, j) => j !== i) }))
                      }
                    >
                      <Ic name="x" size={14} />
                    </button>
                  </div>
                ))}
                <label
                  className={cx(s.drop, over && s.over)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOver(true);
                  }}
                  onDragLeave={() => setOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOver(false);
                    addPhotos(e.dataTransfer.files);
                  }}
                >
                  <Ic name="upload" size={22} />
                  <span aria-live="polite">
                    {uploading ? (
                      tc('image.uploading')
                    ) : (
                      <>
                        {t('addPhotos')}
                        <br />
                        {t('orDrop')}
                      </>
                    )}
                  </span>
                  <input
                    type="file"
                    accept={IMAGE_ACCEPT}
                    multiple
                    onChange={(e) => {
                      addPhotos(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          </section>
          {single && (
            <section className={s.panel}>
              <div className={s.panelH}>
                <h2>{t('priceStock')}</h2>
              </div>
              <div className={s.panelB}>
                <div className={s.g3}>
                  <div className={fieldCls('v0price')} data-bad={isBad('v0price')}>
                    <label htmlFor="pe-v0price">{t('price')}</label>
                    <div className={s.prefix}>
                      <span>$</span>
                      <input
                        id="pe-v0price"
                        value={v0.price}
                        inputMode="decimal"
                        onChange={(e) => setVar(0, 'price', e.target.value)}
                      />
                    </div>
                    <div className={s.err}>{errs.v0price}</div>
                  </div>
                  <div className={fieldCls('v0compare')} data-bad={isBad('v0compare')}>
                    <label htmlFor="pe-v0compare">{t('compareAt')}</label>
                    <div className={s.prefix}>
                      <span>$</span>
                      <input
                        id="pe-v0compare"
                        value={v0.compareAt}
                        inputMode="decimal"
                        placeholder={t('compareHint')}
                        onChange={(e) => setVar(0, 'compareAt', e.target.value)}
                      />
                    </div>
                    <div className={s.err}>{errs.v0compare}</div>
                  </div>
                  <div className={s.field}>
                    <label htmlFor="pe-v0cost">{t('cost')}</label>
                    <div className={s.prefix}>
                      <span>$</span>
                      <input
                        id="pe-v0cost"
                        value={v0.cost}
                        inputMode="decimal"
                        onChange={(e) => setVar(0, 'cost', e.target.value)}
                      />
                    </div>
                    <span className={s.margin}>{margin(v0)}</span>
                  </div>
                </div>
                <div className={s.g3}>
                  <div className={fieldCls('v0sku')} data-bad={isBad('v0sku')}>
                    <label htmlFor="pe-v0sku">{t('sku')}</label>
                    <input
                      id="pe-v0sku"
                      value={v0.sku}
                      onChange={(e) => setVar(0, 'sku', e.target.value)}
                    />
                    <div className={s.err}>{errs.v0sku}</div>
                  </div>
                  <div className={fieldCls('v0barcode')} data-bad={isBad('v0barcode')}>
                    <label htmlFor="pe-v0barcode">{t('barcode')}</label>
                    <input
                      id="pe-v0barcode"
                      value={v0.barcode}
                      inputMode="numeric"
                      placeholder={t('barcodePh')}
                      onChange={(e) => setVar(0, 'barcode', e.target.value)}
                    />
                    <div className={s.err}>{errs.v0barcode}</div>
                  </div>
                  <div className={s.field}>
                    <label htmlFor="pe-v0stock">{isNew ? t('openingStock') : t('inStock')}</label>
                    <input
                      id="pe-v0stock"
                      value={isNew ? v0.stock : liveStock(v0.id)}
                      inputMode="numeric"
                      readOnly={!isNew}
                      onChange={(e) => setVar(0, 'stock', e.target.value)}
                    />
                    {!isNew && (
                      <button
                        type="button"
                        className={cx(s.link, s.quiet, s.tiny)}
                        style={{ justifySelf: 'start' }}
                        onClick={() => adjust(v0.id)}
                      >
                        {t('adjustInInventory')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}
          <section className={s.panel}>
            <div className={s.panelH}>
              <h2>{t('variants')}</h2>
              {d.options.length < 3 && (
                <button
                  type="button"
                  className={cx(s.btn, s.btnGhost, s.btnSm)}
                  onClick={() => {
                    const name =
                      ['Colour', 'Size', 'Storage'].find(
                        (n) => !d.options.some((o) => o.name === n),
                      ) ?? '';
                    edit((x) => ({ ...x, options: [...x.options, { name, values: [] }] }));
                    focusOpt.current = d.options.length;
                  }}
                >
                  <Ic name="plus" size={16} />
                  {single ? t('addOptionsLong') : t('addOption')}
                </button>
              )}
            </div>
            {d.options.length ? (
              <>
                <div className={s.panelB}>
                  {d.options.map((op, oi) => (
                    <div key={oi} className={s.optrow}>
                      <div className={s.field}>
                        <label htmlFor={`pe-on${oi}`} className={cx(s.tiny, s.muted)}>
                          {t('optionName')}
                        </label>
                        <input
                          id={`pe-on${oi}`}
                          value={op.name}
                          list="pe-optnames"
                          placeholder={t('optionNamePh')}
                          onChange={(e) => {
                            const nw = e.target.value;
                            edit((x) => {
                              const old = x.options[oi]?.name ?? '';
                              return {
                                ...x,
                                options: x.options.map((o, j) =>
                                  j === oi ? { ...o, name: nw } : o,
                                ),
                                variants: x.variants.map((v) => {
                                  if (!(old in v.options)) return v;
                                  const o2 = { ...v.options, [nw]: v.options[old] ?? '' };
                                  delete o2[old];
                                  return { ...v, options: o2 };
                                }),
                              };
                            });
                          }}
                          onBlur={() => setDraft((x) => regenVariants(x))}
                        />
                      </div>
                      <div className={cx(s.field, s.vals)}>
                        <span className={cx(s.tiny, s.muted)}>{t('valuesHint')}</span>
                        <div className={s.tagin}>
                          {op.values.map((val, vi) => (
                            <span key={val}>
                              {val}
                              <button
                                type="button"
                                aria-label={t('removeValue', { v: val })}
                                onClick={() =>
                                  edit((x) =>
                                    regenVariants({
                                      ...x,
                                      options: x.options.map((o, j) =>
                                        j === oi
                                          ? { ...o, values: o.values.filter((_, k) => k !== vi) }
                                          : o,
                                      ),
                                    }),
                                  )
                                }
                              >
                                <Ic name="x" size={12} />
                              </button>
                            </span>
                          ))}
                          <input
                            data-addval={oi}
                            placeholder={op.values.length ? t('addAnother') : t('valuePh')}
                            aria-label={t('addValueTo', { name: op.name || t('option') })}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter' && e.key !== ',') return;
                              e.preventDefault();
                              if (addValue(oi, e.currentTarget.value)) e.currentTarget.value = '';
                            }}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        className={s.ibtn}
                        style={{ marginTop: 20 }}
                        aria-label={t('removeOption')}
                        onClick={() =>
                          edit((x) =>
                            regenVariants({ ...x, options: x.options.filter((_, j) => j !== oi) }),
                          )
                        }
                      >
                        <Ic name="trash" size={18} />
                      </button>
                    </div>
                  ))}
                  <datalist id="pe-optnames">
                    {['Colour', 'Size', 'Storage', 'Model', 'Material'].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </datalist>
                  <div className={s.err}>{errs.opts}</div>
                </div>
                {d.variants.length > 0 && d.options.every((o) => o.values.length) ? (
                  <>
                    <div className={s.tblWrap}>
                      <table className={s.vt} style={{ minWidth: 760 }}>
                        <thead>
                          <tr>
                            <th>{t('col.variant')}</th>
                            <th>{t('price')}</th>
                            <th>{t('col.compare')}</th>
                            <th>{t('col.cost')}</th>
                            <th>{t('sku')}</th>
                            <th>{t('barcode')}</th>
                            <th className={s.r}>{t('col.stock')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.variants.map((v, i) => {
                            const name = Object.values(v.options).join(' / ');
                            const existing = !!src?.variants.some((x) => x.id === v.id);
                            return (
                              <tr key={v.id}>
                                <td>
                                  <b style={{ fontWeight: 500 }}>{name}</b>
                                </td>
                                <td
                                  className={cx(isBad(`v${i}price`) && s.bad)}
                                  data-bad={isBad(`v${i}price`)}
                                >
                                  <div className={cx(s.prefix, s.vtPrefix)}>
                                    <span>$</span>
                                    <input
                                      value={v.price}
                                      inputMode="decimal"
                                      aria-label={t('aPrice', { v: name })}
                                      onChange={(e) => setVar(i, 'price', e.target.value)}
                                    />
                                  </div>
                                </td>
                                <td>
                                  <input
                                    value={v.compareAt}
                                    inputMode="decimal"
                                    aria-label={t('aCompare', { v: name })}
                                    onChange={(e) => setVar(i, 'compareAt', e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    value={v.cost}
                                    inputMode="decimal"
                                    aria-label={t('aCost', { v: name })}
                                    onChange={(e) => setVar(i, 'cost', e.target.value)}
                                  />
                                </td>
                                <td
                                  className={cx(isBad(`v${i}sku`) && s.bad)}
                                  data-bad={isBad(`v${i}sku`)}
                                >
                                  <input
                                    value={v.sku}
                                    aria-label={t('aSku', { v: name })}
                                    onChange={(e) => setVar(i, 'sku', e.target.value)}
                                  />
                                </td>
                                <td
                                  className={cx(isBad(`v${i}barcode`) && s.bad)}
                                  data-bad={isBad(`v${i}barcode`)}
                                >
                                  <input
                                    value={v.barcode}
                                    aria-label={t('aBarcode', { v: name })}
                                    onChange={(e) => setVar(i, 'barcode', e.target.value)}
                                  />
                                </td>
                                <td className={s.r}>
                                  {isNew || !existing ? (
                                    <input
                                      value={v.stock}
                                      inputMode="numeric"
                                      style={{ width: 64, textAlign: 'right' }}
                                      aria-label={t('aStock', { v: name })}
                                      onChange={(e) => setVar(i, 'stock', e.target.value)}
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      className={cx(s.link, s.quiet, s.num)}
                                      onClick={() => adjust(v.id)}
                                    >
                                      {liveStock(v.id)}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className={s.panelB} style={{ paddingTop: 8 }}>
                      <div className={s.err}>{errs.vars}</div>
                      <span className={s.hint}>{t('variantsHint', { n: d.variants.length })}</span>
                    </div>
                  </>
                ) : (
                  <div className={s.panelB}>
                    <span className={s.hint}>{t('needValues')}</span>
                  </div>
                )}
              </>
            ) : (
              <div className={s.panelB}>
                <span className={s.hint}>{t('oneVersion')}</span>
              </div>
            )}
          </section>
        </div>
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <section className={s.panel}>
            <div className={s.panelH}>
              <h2>{t('status')}</h2>
            </div>
            <div className={s.panelB}>
              <select
                className={s.select}
                style={{ width: '100%' }}
                value={d.status}
                aria-label={t('status')}
                onChange={(e) => {
                  const v = e.target.value as ProductDraft['status'];
                  edit((x) => ({ ...x, status: v }));
                }}
              >
                <option value="ACTIVE">{t('statusActive')}</option>
                <option value="DRAFT">{t('statusDraft')}</option>
              </select>
            </div>
          </section>
          <section className={s.panel}>
            <div className={s.panelH}>
              <h2>{t('organisation')}</h2>
            </div>
            <div className={s.panelB}>
              <div className={fieldCls('cat')} data-bad={isBad('cat')}>
                <label htmlFor="pe-cat">{t('category')}</label>
                <select
                  id="pe-cat"
                  value={d.collection}
                  onChange={(e) => {
                    const v = e.target.value;
                    edit((x) => ({ ...x, collection: v }), 'cat');
                  }}
                >
                  <option value="">{t('choose')}</option>
                  {db.collections.map((c) => (
                    <option key={c} value={c}>
                      {tcol(c)}
                    </option>
                  ))}
                </select>
                <div className={s.err}>{errs.cat}</div>
              </div>
              <div className={s.field}>
                <label htmlFor="pe-low">{t('lowAt')}</label>
                <input
                  id="pe-low"
                  value={d.lowStockAt}
                  inputMode="numeric"
                  onChange={(e) => {
                    const v = +e.target.value.replace(/\D/g, '') || 0;
                    edit((x) => ({ ...x, lowStockAt: v }));
                  }}
                />
                <span className={s.hint}>{t('lowAtHint')}</span>
              </div>
            </div>
          </section>
          {src && (
            <section className={s.panel}>
              <div className={s.panelH}>
                <h2>{t('performance')}</h2>
              </div>
              <div className={s.panelB}>
                <div className={s.sum}>
                  <div>
                    <span className={s.muted}>{t('soldAll')}</span>
                    <span>{src.sold}</span>
                  </div>
                  <div>
                    <span className={s.muted}>{t('rating')}</span>
                    <span>{src.rating ? `${src.rating.toFixed(1)} ★` : '–'}</span>
                  </div>
                  <div>
                    <span className={s.muted}>{t('inStock')}</span>
                    <span>{stockOf(src)}</span>
                  </div>
                </div>
                <Link
                  className={cx(s.link, s.small)}
                  href={`/seller/inventory?q=${encodeURIComponent(src.title)}`}
                >
                  {t('stockHistory')}
                </Link>
              </div>
            </section>
          )}
          <button
            type="submit"
            className={cx(s.btn, s.btnPrimary, s.btnLg)}
            disabled={saving || uploading > 0}
            aria-busy={saving}
          >
            {saving ? t('saving') : isNew ? t('saveProduct') : t('save')}
          </button>
        </div>
      </form>
    </>
  );
}
