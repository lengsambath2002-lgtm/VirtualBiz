'use client';

import { useTranslations } from 'next-intl';

import { useImageUpload } from '@/lib/hooks/useImageUpload';
import { cn } from '@/lib/utils/cn';
import { photoBg } from '@/lib/utils/photo';

import s from './ShopPhotos.module.css';

export interface ShopPhotosPatch {
  logoUrl?: string;
  coverUrl?: string;
}

/**
 * A business's logo and cover: the cover band with the logo over its lower edge, and buttons to
 * upload (`POST /api/files`) or remove each. `onSave` stores the URL ('' removes the photo) on
 * the business and resolves true when saved; the surface passes its own button classes.
 */
export function ShopPhotos({
  name,
  logoUrl,
  coverUrl,
  onSave,
  onToast,
  btn,
  btnGhost,
}: {
  name: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  onSave: (patch: ShopPhotosPatch) => Promise<boolean>;
  onToast: (message: string) => void;
  /** Class for the main button and for the quieter ones. */
  btn: string;
  btnGhost: string;
}) {
  const t = useTranslations('common.image');
  const save = async (patch: ShopPhotosPatch, removed = false) => {
    if (await onSave(patch)) onToast(t(removed ? 'removed' : 'saved'));
  };
  const logo = useImageUpload('BUSINESS_LOGO', (url) => save({ logoUrl: url }), onToast);
  const cover = useImageUpload('BUSINESS_COVER', (url) => save({ coverUrl: url }), onToast);
  const busy = logo.busy || cover.busy;
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <div>
      <div className={s.cover} style={photoBg(coverUrl)} data-testid="shop-cover">
        <button
          type="button"
          className={cn(btnGhost, s.coverBtn)}
          disabled={busy}
          onClick={() => void cover.pick()}
        >
          {cover.busy ? t('uploading') : coverUrl ? t('changeCover') : t('addCover')}
        </button>
      </div>
      <div className={s.row}>
        <span className={s.logo} style={photoBg(logoUrl)} data-testid="shop-logo">
          {logoUrl ? null : letters}
        </span>
        <div className={s.btns}>
          <button type="button" className={btn} disabled={busy} onClick={() => void logo.pick()}>
            {logo.busy ? t('uploading') : logoUrl ? t('changeLogo') : t('addLogo')}
          </button>
          {logoUrl && (
            <button
              type="button"
              className={btnGhost}
              disabled={busy}
              onClick={() => void save({ logoUrl: '' }, true)}
            >
              {t('removeLogo')}
            </button>
          )}
          {coverUrl && (
            <button
              type="button"
              className={btnGhost}
              disabled={busy}
              onClick={() => void save({ coverUrl: '' }, true)}
            >
              {t('removeCover')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
