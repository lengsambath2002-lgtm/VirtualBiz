// Firebase Authentication: Google and email + password (docs/ops/firebase.md). Each returns the
// Firebase ID token, which `/api/auth/firebase` turns into a VirtualBiz session.
import { firebaseAuth } from './app';
import { firebaseEnabled } from './config';

/** A Firebase Auth error code (`auth/invalid-credential`…), or null for anything else. */
export function firebaseCode(e: unknown): string | null {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code.startsWith('auth/') ? code : null;
}

/** Codes meaning "this email + password isn't a Firebase account (yet)". */
export const NOT_A_FIREBASE_LOGIN = new Set([
  'auth/invalid-credential',
  'auth/invalid-login-credentials',
  'auth/user-not-found',
  'auth/wrong-password',
]);

export async function passwordIdToken(email: string, password: string): Promise<string> {
  const [auth, m] = await Promise.all([firebaseAuth(), import('firebase/auth')]);
  const cred = await m.signInWithEmailAndPassword(auth, email, password);
  return cred.user.getIdToken();
}

/** Google's account chooser in a popup. Throws `auth/popup-closed-by-user` when it is closed. */
export async function googleIdToken(locale: string): Promise<string> {
  const [auth, m] = await Promise.all([firebaseAuth(), import('firebase/auth')]);
  auth.languageCode = locale === 'kh' ? 'km' : 'en';
  const provider = new m.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await m.signInWithPopup(auth, provider);
  return cred.user.getIdToken();
}

/** VirtualBiz keeps its own session; the Firebase one is only used to sign in, so end it too. */
export async function firebaseSignOut(): Promise<void> {
  if (!firebaseEnabled()) return;
  try {
    const [auth, m] = await Promise.all([firebaseAuth(), import('firebase/auth')]);
    await m.signOut(auth);
  } catch {
    /* nothing to end */
  }
}
