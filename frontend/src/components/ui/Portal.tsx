'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders a dialog at the top of its workspace (the element marked `data-overlay-root`, else the
 * page body) instead of where it is used. A full-screen backdrop drawn inside a panel with a blur,
 * filter or transform is trapped in that panel's box; out here it covers the screen and still has
 * the workspace's colours and fonts.
 */
export function Portal({ children }: { children: ReactNode }) {
  const [at, setAt] = useState<Element | null>(null);
  useEffect(() => setAt(document.querySelector('[data-overlay-root]') ?? document.body), []);
  return at ? createPortal(children, at) : null;
}
