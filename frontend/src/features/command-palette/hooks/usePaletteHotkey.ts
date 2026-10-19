'use client';

import { useEffect, useRef } from 'react';

/** Calls `onOpen` on Ctrl+K / ⌘K anywhere on the page. */
export function usePaletteHotkey(onOpen: () => void) {
  const cb = useRef(onOpen);
  cb.current = onOpen;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        cb.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}
