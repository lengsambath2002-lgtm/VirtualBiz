'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { imageErrorKey, pickImage, uploadImage, type FilePurpose } from '@/lib/api';

/**
 * Pick one image, upload it (`POST /api/files`), then hand its URL to `onUploaded` (which
 * usually saves it on the profile, shop or product). Any failure, the upload's or the save's,
 * reaches `onError` as a translated message.
 */
export function useImageUpload(
  purpose: FilePurpose,
  onUploaded: (url: string) => Promise<unknown> | void,
  onError: (message: string) => void,
) {
  const tc = useTranslations('common');
  const [busy, setBusy] = useState(false);
  const pick = async () => {
    if (busy) return;
    const file = await pickImage();
    if (!file) return;
    setBusy(true);
    try {
      const uploaded = await uploadImage(file, purpose);
      await onUploaded(uploaded.url);
    } catch (e) {
      onError(tc(imageErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };
  return { pick, busy };
}
