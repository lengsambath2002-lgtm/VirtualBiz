// Image uploads (docs/api/phase6-files-profiles.md): `POST /api/files` returns the URL to put in
// an avatar, cover, logo or product photo field. The API checks the bytes; this checks first so
// the user hears about a wrong file at once.
import { api, ApiError, fallbackErrorKey } from './client';

export type FilePurpose =
  | 'AVATAR'
  | 'USER_COVER'
  | 'BUSINESS_LOGO'
  | 'BUSINESS_COVER'
  | 'PRODUCT_PHOTO'
  | 'SITE_BANNER';

export interface UploadedFile {
  id: string;
  url: string;
  purpose: FilePurpose;
  contentType: string;
  size: number;
}

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** `accept` for an `<input type="file">`. */
export const IMAGE_ACCEPT = IMAGE_TYPES.join(',');

/** Throws `ApiError` (`UNSUPPORTED_FILE`, `FILE_TOO_LARGE`, or the API's own). */
export async function uploadImage(file: File, purpose: FilePurpose): Promise<UploadedFile> {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type))
    throw new ApiError('UNSUPPORTED_FILE', 415);
  if (file.size > MAX_IMAGE_BYTES) throw new ApiError('FILE_TOO_LARGE', 413);
  const form = new FormData();
  form.append('file', file);
  form.append('purpose', purpose);
  return api.upload<UploadedFile>('/files', form);
}

/** Opens the file chooser for one image; resolves the chosen file, or null when cancelled. */
export function pickImage(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = IMAGE_ACCEPT;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

/** `common` message key for a failed upload. */
export const imageErrorKey = (
  e: unknown,
):
  | 'errors.imageType'
  | 'errors.imageSize'
  | 'errors.unavailable'
  | 'errors.network'
  | 'errors.generic'
  | 'errors.suspended' =>
  e instanceof ApiError && e.code === 'UNSUPPORTED_FILE'
    ? 'errors.imageType'
    : e instanceof ApiError && e.code === 'FILE_TOO_LARGE'
      ? 'errors.imageSize'
      : fallbackErrorKey(e);
