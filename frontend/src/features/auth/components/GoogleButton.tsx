'use client';

import { useEffect, useRef } from 'react';

/** Google Identity Services, loaded from Google when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set. */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

interface GoogleId {
  initialize: (opts: { client_id: string; callback: (r: { credential?: string }) => void }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
}
type GoogleWindow = Window & { google?: { accounts?: { id?: GoogleId } } };

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let loading: Promise<GoogleId | null> | null = null;

function loadGis(): Promise<GoogleId | null> {
  const w = window as GoogleWindow;
  if (w.google?.accounts?.id) return Promise.resolve(w.google.accounts.id);
  loading ??= new Promise((resolve) => {
    const el = document.createElement('script');
    el.src = GIS_SRC;
    el.async = true;
    el.onload = () => resolve((window as GoogleWindow).google?.accounts?.id ?? null);
    el.onerror = () => {
      loading = null;
      resolve(null);
    };
    document.head.appendChild(el);
  });
  return loading;
}

/** Google's own "Sign in with Google" button; calls `onCredential` with the ID token. */
export function GoogleButton({
  onCredential,
  onUnavailable,
  locale,
}: {
  onCredential: (idToken: string) => void;
  onUnavailable: () => void;
  locale: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  const fail = useRef(onUnavailable);
  cb.current = onCredential;
  fail.current = onUnavailable;

  useEffect(() => {
    let live = true;
    void loadGis().then((gis) => {
      if (!live || !box.current) return;
      if (!gis) return fail.current();
      gis.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (r) => (r.credential ? cb.current(r.credential) : fail.current()),
      });
      gis.renderButton(box.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        width: Math.min(360, box.current.clientWidth || 320),
        locale: locale === 'kh' ? 'km' : 'en',
      });
    });
    return () => {
      live = false;
    };
  }, [locale]);

  return <div ref={box} style={{ display: 'flex', justifyContent: 'center', minHeight: 44 }} />;
}
