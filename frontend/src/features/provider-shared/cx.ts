import s from './provider.module.css';

type Name = string | false | null | undefined | 0;

/**
 * Map the prototype's class names to this feature's CSS module: `k('btn btn-primary', on && 'on')`.
 * Unknown names pass through unchanged.
 */
export function k(...names: Name[]): string {
  return names
    .filter(Boolean)
    .flatMap((n) => String(n).split(/\s+/))
    .filter(Boolean)
    .map((n) => s[n] ?? n)
    .join(' ');
}

export { s as styles };
