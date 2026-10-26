'use client';

import { useCallback, useSyncExternalStore } from 'react';

import { THEME_KEY as KEY, type ThemePref } from './script';

const EVENT = 'vb-theme';

function read(): ThemePref {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

function apply(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
}

function subscribe(onChange: () => void) {
  // Another tab changed it: follow.
  const storage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    apply(read());
    onChange();
  };
  window.addEventListener('storage', storage);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener('storage', storage);
    window.removeEventListener(EVENT, onChange);
  };
}

/** The chosen theme and a setter that applies and remembers it. */
export function useTheme(): [ThemePref, (pref: ThemePref) => void] {
  const pref = useSyncExternalStore(subscribe, read, () => 'system' as const);
  const set = useCallback((next: ThemePref) => {
    try {
      if (next === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // Private mode or storage blocked: still apply it for this page.
    }
    apply(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [pref, set];
}
