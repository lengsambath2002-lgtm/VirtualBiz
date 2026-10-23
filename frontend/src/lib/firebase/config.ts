// Firebase web config (docs/ops/firebase.md). It is public by design: what protects the project is
// the authorized domains and the API key's restrictions, not keeping these values secret.
export const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
};

/** The Web Push certificate (Cloud Messaging → Web configuration). */
export const FIREBASE_VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? '';

/** Local Auth emulator (`http://127.0.0.1:9099`), for tests and offline work. */
export const FIREBASE_AUTH_EMULATOR = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR ?? '';

/** Sign-in goes through Firebase (Google, email + password) when the web config is set. */
export const firebaseEnabled = () => !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);

/** Push notifications also need a sender id, an app id and the Web Push key. */
export const pushConfigured = () =>
  firebaseEnabled() && !!(FIREBASE_CONFIG.messagingSenderId && FIREBASE_CONFIG.appId && FIREBASE_VAPID_KEY);
