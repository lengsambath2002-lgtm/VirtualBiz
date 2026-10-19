'use client';

import { useEffect, useRef } from 'react';

export interface HardwareScannerOptions {
  /** Listen only while true (e.g. on the register with no dialog open). */
  enabled: boolean;
  /** Called with the scanned code when Enter ends a fast burst of keys. */
  onScan: (code: string) => void;
  /** Shortest code accepted (prototype: 6). */
  minLength?: number;
  /** Max gap between keystrokes of one scan, ms (prototype: 60). */
  gapMs?: number;
}

/**
 * USB / Bluetooth barcode scanners act as keyboards: they type the code very fast and press
 * Enter. This catches such bursts anywhere on the page, ignoring keys typed into fields.
 */
export function useHardwareScanner({
  enabled,
  onScan,
  minLength = 6,
  gapMs = 60,
}: HardwareScannerOptions) {
  const cb = useRef(onScan);
  cb.current = onScan;
  useEffect(() => {
    if (!enabled) return;
    let buf = '';
    let at = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.matches?.('input,textarea,select')) return;
      const now = Date.now();
      if (now - at > gapMs) buf = '';
      at = now;
      if (/^[0-9A-Za-z-]$/.test(e.key)) buf += e.key;
      else if (e.key === 'Enter' && buf.length >= minLength) {
        const code = buf;
        buf = '';
        cb.current(code);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled, minLength, gapMs]);
}
