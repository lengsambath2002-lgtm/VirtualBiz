'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** One toast at a time, replaced by the next, gone after 3 s (prototype `toast()`). */
export function useToast() {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((message: string) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message });
    timer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { toast, show };
}
