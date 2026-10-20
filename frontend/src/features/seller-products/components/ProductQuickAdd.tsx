'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState, type FormEvent } from 'react';

import {
  cx,
  Ic,
  Modal,
  s,
  SwitchRow,
  useCollectionName,
  useDb,
  useFmt,
  useSellerStore,
  useUi,
  type ProductDraft,
} from '@/features/seller-shared';
import {
  IMAGE_ACCEPT,
  IMAGE_TYPES,
  imageErrorKey,
  isApiError,
  MAX_IMAGE_BYTES,
  uploadImage,
} from '@/lib/api';
import { Link } from '@/lib/i18n/navigation';

const MAX_PHOTOS = 4;
type Errs = Partial<
  Record<'title' | 'cat' | 'price' | 'compare' | 'sku' | 'barcode' | 'stock', string>
>;

/**
 * "Add product" as a popup: the one-variant product most shops add (photos, name, category,
 * price, opening stock, SKU / barcode, live or draft). Saved through the same store action as
 * the full editor; products with sizes or colours open the full editor instead.
 */
export function ProductQuickAdd() {
  const t = useTranslations('seller.quickAdd');
  const te = useTranslations('seller.editor');
  const tc = useTranslations('common');
  const tcol = useCollectionName();
  const db = useDb();
  const f = useFmt();
  const ui = useUi();
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [title, setTitle] = useState('');
  const [collection, setCollection] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [compareAt, setCompareAt] = useState('');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [live, setLive] = useState(true);
  const [errs, setErrs] = useState<Errs>({});
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  /** Editing a field clears its error. */
  const edit =
    (k: keyof Errs | null, set: (v: string) => void) => (e: { target: { value: string } }) => {
      set(e.target.value);
      if (k && errs[k]) setErrs((x) => ({ ...x, [k]: undefined }));
    };

  const addPhotos = (files: FileList | null) => {
    [...(files ?? [])].slice(0, MAX_PHOTOS - photos.length).forEach((file) => {
      if (!(IMAGE_TYPES as readonly string[]).includes(file.type))
        return ui.showToast(te('photoType'));
      if (file.size > MAX_IMAGE_BYTES) return ui.showToast(te('photoSize', { name: file.name }));
      setUploading((n) => n + 1);
      uploadImage(file, 'PRODUCT_PHOTO')
        .then((up) => setPhotos((ps) => [...ps, up.url].slice(0, MAX_PHOTOS)))
        .catch((e: unknown) => ui.showToast(tc(imageErrorKey(e))))
        .finally(() => setUploading((n) => n - 1));
    });
  };

  const p = parseFloat(price);
  const c = parseFloat(cost);
  const margin = p > 0 && c > 0 ? Math.round(((p - c) / p) * 100) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const x: Errs = {};
    if (title.trim().length < 2) x.title = te('err.title');
    if (!collection) x.cat = te('err.cat');
    if (!(p > 0)) x.price = te('err.price');
    else if (compareAt && parseFloat(compareAt) <= p) x.compare = te('err.compare');
    const n = stock.trim() ? Number(stock) : 0;
    if (!Number.isInteger(n) || n < 0 || n > 99999) x.stock = t('errStock');
    const others = db.products.flatMap((pr) => pr.variants);
    if (sku.trim() && others.some((v) => v.sku === sku.trim())) x.sku = te('err.sku');
    if (barcode.trim() && others.some((v) => v.barcode === barcode.trim()))
      x.barcode = te('err.barcode');
    setErrs(x);
    if (Object.keys(x).length || saving || uploading) return;
    const draft: ProductDraft = {
      id: null,
      title: title.trim(),
      collection,
      status: live ? 'ACTIVE' : 'DRAFT',
      description: description.trim(),
      lowStockAt: db.shop.lowStockDefault,
      options: [],
      variants: [
        {
          id: `new-${Math.random().toString(36).slice(2, 8)}`,
          options: {},
          price,
          compareAt,
          cost,
          sku: sku.trim(),
          barcode: barcode.trim(),
          stock: n,
        },
      ],
      photos,
      sold: 0,
      rating: 0,
    };
    setSaving(true);
    try {
      await useSellerStore.getState().saveProduct(draft);
      ui.close();
      ui.showToast(
        live ? te('live', { title: draft.title }) : te('savedDraft', { title: draft.title }),
      );
    } catch (err) {
      if (isApiError(err, 'DUPLICATE_SKU')) setErrs({ sku: te('err.sku') });
      else if (isApiError(err, 'DUPLICATE_BARCODE')) setErrs({ barcode: te('err.barcode') });
      else ui.showToast(te('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const field = (
    id: string,
    label: string,
    err: string | undefined,
    input: React.ReactNode,
    hint?: React.ReactNode,
  ) => (
    <div className={cx(s.field, err && s.bad)}>
      <label htmlFor={id}>{label}</label>
      {input}
      {hint && <span className={s.hint}>{hint}</span>}
      <div className={s.err}>{err}</div>
    </div>
  );

  return (
    <Modal wide label={t('title')}>
      <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 14 }}>
        <div>
          <h2>{t('title')}</h2>
          <p className={cx(s.muted, s.small)}>{t('hint')}</p>
        </div>

        <div className={s.field}>
          <span>{t('photos')}</span>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {photos.map((ph, i) => (
              <div
                key={ph}
                className={s.thumb}
                style={{
                  width: 76,
                  height: 76,
                  backgroundImage: `url(${ph})`,
                  position: 'relative',
                }}
              >
                <button
                  type="button"
                  className={s.close}
                  style={{ position: 'absolute', top: 2, right: 2, width: 22, height: 22 }}
                  aria-label={te('removePhoto', { n: i + 1 })}
                  onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                >
                  <Ic name="x" size={12} />
                </button>
                {i === 0 && (
                  <span
                    className={cx(s.pill, s.neutral)}
                    style={{ position: 'absolute', bottom: 2, left: 2, fontSize: 10 }}
                  >
                    {t('cover')}
                  </span>
                )}
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                className={s.drop}
                style={{ width: 76, height: 76, padding: 0 }}
                onClick={() => fileRef.current?.click()}
                aria-busy={uploading > 0}
              >
                {uploading ? <span className={s.spin} /> : <Ic name="upload" size={20} />}
                <span className={s.tiny}>{uploading ? tc('image.uploading') : t('addPhoto')}</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              hidden
              multiple
              accept={IMAGE_ACCEPT}
              onChange={(e) => {
                addPhotos(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <div className={s.g2}>
          {field(
            'qa-title',
            t('name'),
            errs.title,
            <input
              id="qa-title"
              value={title}
              placeholder={t('namePh')}
              onChange={edit('title', setTitle)}
            />,
          )}
          {field(
            'qa-cat',
            t('category'),
            errs.cat,
            <select id="qa-cat" value={collection} onChange={edit('cat', setCollection)}>
              <option value="">{t('chooseCategory')}</option>
              {db.collections.map((col) => (
                <option key={col} value={col}>
                  {tcol(col)}
                </option>
              ))}
            </select>,
          )}
        </div>
        {field(
          'qa-desc',
          t('description'),
          undefined,
          <textarea
            id="qa-desc"
            rows={2}
            maxLength={2000}
            value={description}
            placeholder={t('descriptionPh')}
            onChange={edit(null, setDescription)}
          />,
        )}

        <div className={s.g3}>
          {field(
            'qa-price',
            t('price'),
            errs.price,
            <input
              id="qa-price"
              inputMode="decimal"
              value={price}
              placeholder="0.00"
              onChange={edit('price', setPrice)}
            />,
            p > 0 ? f.khr(p) : undefined,
          )}
          {field(
            'qa-compare',
            t('compareAt'),
            errs.compare,
            <input
              id="qa-compare"
              inputMode="decimal"
              value={compareAt}
              placeholder="0.00"
              onChange={edit('compare', setCompareAt)}
            />,
            t('compareHint'),
          )}
          {field(
            'qa-cost',
            t('cost'),
            undefined,
            <input
              id="qa-cost"
              inputMode="decimal"
              value={cost}
              placeholder="0.00"
              onChange={edit(null, setCost)}
            />,
            margin !== null ? t('margin', { pct: margin }) : t('costHint'),
          )}
        </div>

        <div className={s.g3}>
          {field(
            'qa-stock',
            t('stock'),
            errs.stock,
            <input
              id="qa-stock"
              inputMode="numeric"
              value={stock}
              placeholder="0"
              onChange={edit('stock', setStock)}
            />,
          )}
          {field(
            'qa-sku',
            t('sku'),
            errs.sku,
            <input id="qa-sku" value={sku} autoComplete="off" onChange={edit('sku', setSku)} />,
          )}
          {field(
            'qa-barcode',
            t('barcode'),
            errs.barcode,
            <input
              id="qa-barcode"
              value={barcode}
              autoComplete="off"
              onChange={edit('barcode', setBarcode)}
            />,
            t('barcodeHint'),
          )}
        </div>

        <SwitchRow
          title={t('liveTitle')}
          hint={live ? t('liveOn') : t('liveOff')}
          checked={live}
          onChange={setLive}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Link
            className={cx(s.link, s.small)}
            href="/seller/products/new"
            onClick={() => ui.close()}
          >
            {t('fullEditor')}
          </Link>
          <span style={{ flex: 1 }} />
          <button type="button" className={cx(s.btn, s.btnGhost)} onClick={() => ui.close()}>
            {t('cancel')}
          </button>
          <button
            type="submit"
            className={cx(s.btn, s.btnPrimary)}
            disabled={saving || uploading > 0}
            aria-busy={saving}
          >
            {saving ? t('saving') : live ? t('addLive') : t('addDraft')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
