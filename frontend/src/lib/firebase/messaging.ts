// Firebase Cloud Messaging on the web (docs/ops/firebase.md): this browser's push token, through
// the service worker in public/firebase-messaging-sw.js (it gets the config in its URL).
import { firebaseApp } from './app';
import { FIREBASE_CONFIG, FIREBASE_VAPID_KEY, pushConfigured } from './config';

const SW_PATH = '/firebase-messaging-sw.js';

/** Whether this browser can get push notifications at all (and the app is set up for them). */
export async function pushSupported(): Promise<boolean> {
  if (!pushConfigured() || typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return false;
  const { isSupported } = await import('firebase/messaging');
  return isSupported().catch(() => false);
}

async function worker(): Promise<ServiceWorkerRegistration> {
  const q = new URLSearchParams(FIREBASE_CONFIG).toString();
  return navigator.serviceWorker.register(`${SW_PATH}?${q}`, { scope: '/firebase-cloud-messaging-push-scope' });
}

/**
 * Asks to show notifications (when not answered yet) and returns this browser's token.
 * `'denied'` when the person (or the browser) said no.
 */
export async function pushToken(): Promise<string | 'denied'> {
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') return 'denied';
  const [app, m, sw] = await Promise.all([firebaseApp(), import('firebase/messaging'), worker()]);
  return m.getToken(m.getMessaging(app), { vapidKey: FIREBASE_VAPID_KEY, serviceWorkerRegistration: sw });
}

/** Forgets this browser's token with Firebase (push turned off). */
export async function dropPushToken(): Promise<void> {
  const [app, m] = await Promise.all([firebaseApp(), import('firebase/messaging')]);
  await m.deleteToken(m.getMessaging(app)).catch(() => undefined);
}
