'use client';

import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';

import { dropPushToken, pushSupported, pushToken } from './messaging';

const KEY = 'vb-push-token';

const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const write = (v: string | null) => {
  try {
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  } catch {
    /* private window: push still works until the page closes */
  }
};

export type PushState = 'unsupported' | 'off' | 'on' | 'denied';

/**
 * Push notifications on this browser (docs/ops/firebase.md): the toggle in My settings. Turning
 * it on asks the browser's permission and registers this browser's token with VirtualBiz
 * (`/api/me/push-tokens`); off forgets it on both sides. The token is refreshed on each visit.
 */
export function usePush() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void pushSupported().then(async (ok) => {
      if (!live) return;
      if (!ok) return setState('unsupported');
      if (Notification.permission === 'denied') return setState('denied');
      const had = read();
      if (!had || Notification.permission !== 'granted') return setState('off');
      setState('on');
      // Firebase may have rotated it: keep VirtualBiz's copy current.
      try {
        const now = await pushToken();
        if (now !== 'denied' && now !== had) {
          await apiFetch('/me/push-tokens', {
            method: 'POST',
            body: { token: now, platform: 'web' },
          });
          write(now);
        }
      } catch {
        /* next visit */
      }
    });
    return () => {
      live = false;
    };
  }, []);

  const turnOn = useCallback(async () => {
    setBusy(true);
    try {
      const token = await pushToken();
      if (token === 'denied') return setState('denied');
      await apiFetch('/me/push-tokens', { method: 'POST', body: { token, platform: 'web' } });
      write(token);
      setState('on');
    } finally {
      setBusy(false);
    }
  }, []);

  const turnOff = useCallback(async () => {
    setBusy(true);
    try {
      const token = read();
      if (token) await apiFetch('/me/push-tokens', { method: 'DELETE', body: { token } });
      await dropPushToken();
      write(null);
      setState('off');
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, turnOn, turnOff };
}

/** On sign-out: this browser stops getting the account's notifications. */
export async function forgetPushOnSignOut(): Promise<void> {
  const token = read();
  if (!token) return;
  write(null);
  try {
    await apiFetch('/me/push-tokens', { method: 'DELETE', body: { token } });
  } catch {
    /* the server drops it when Firebase reports it gone */
  }
  await dropPushToken().catch(() => undefined);
}
