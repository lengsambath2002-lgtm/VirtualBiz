// The Firebase SDK, loaded only when it is used (sign-in, push), so pages that never need it don't
// carry it. Browser only.
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';

import { FIREBASE_AUTH_EMULATOR, FIREBASE_CONFIG } from './config';

let app: Promise<FirebaseApp> | null = null;
let auth: Promise<Auth> | null = null;

export function firebaseApp(): Promise<FirebaseApp> {
  app ??= import('firebase/app').then(({ getApps, initializeApp }) => getApps()[0] ?? initializeApp(FIREBASE_CONFIG));
  return app;
}

export function firebaseAuth(): Promise<Auth> {
  auth ??= Promise.all([firebaseApp(), import('firebase/auth')]).then(([a, m]) => {
    const it = m.getAuth(a);
    if (FIREBASE_AUTH_EMULATOR && !it.emulatorConfig) {
      m.connectAuthEmulator(it, FIREBASE_AUTH_EMULATOR, { disableWarnings: true });
    }
    return it;
  });
  return auth;
}
