import type { CSSProperties } from 'react';

/**
 * Style that fills an avatar, logo or cover box with an uploaded photo; undefined when there is
 * none, so the box keeps its initials or gradient.
 */
export function photoBg(url: string | null | undefined): CSSProperties | undefined {
  return url
    ? {
        backgroundImage: `url("${url}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: 'transparent',
      }
    : undefined;
}
