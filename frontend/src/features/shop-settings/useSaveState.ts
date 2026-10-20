'use client';

import { useState } from 'react';

/** "Saving… / Saved / Couldn't save" for a panel's save button. */
export function useSaveState() {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const run = async (fn: () => Promise<boolean>) => {
    setState('saving');
    const ok = await fn().catch(() => false);
    setState(ok ? 'saved' : 'failed');
    return ok;
  };
  return { state, run, reset: () => setState('idle') };
}
