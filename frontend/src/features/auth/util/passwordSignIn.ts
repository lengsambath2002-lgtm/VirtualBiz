// Email + password sign-in (docs/ops/firebase.md). With Firebase set up, the password is checked
// by Firebase and its ID token exchanged for a session. An account made before Firebase (or whose
// Firebase login doesn't match yet) is moved over first: VirtualBiz checks the password it keeps,
// with the usual lockout and errors, and gives the Firebase login the same one. Without Firebase,
// or if Firebase can't be reached, VirtualBiz checks the password itself.
import type { AuthSession } from '@/lib/api';
import { isApiError } from '@/lib/api';
import { firebaseCode, firebaseEnabled, NOT_A_FIREBASE_LOGIN, passwordIdToken } from '@/lib/firebase';

import { firebaseMigrate, firebaseSignIn, login } from '../api';

export async function passwordSignIn(email: string, password: string): Promise<AuthSession> {
  if (!firebaseEnabled()) return login(email, password);
  try {
    return await firebaseSignIn(await passwordIdToken(email, password));
  } catch (e) {
    const code = firebaseCode(e);
    const move = (code && NOT_A_FIREBASE_LOGIN.has(code)) || isApiError(e, 'EMAIL_NOT_VERIFIED');
    if (!move) return login(email, password);
  }
  await firebaseMigrate(email, password); // throws INVALID_CREDENTIALS / ACCOUNT_LOCKED like `login`
  try {
    return await firebaseSignIn(await passwordIdToken(email, password));
  } catch {
    return login(email, password);
  }
}

/** After a sign-up: its Firebase login gets the same password (best effort; signing in does it too). */
export function linkFirebaseLogin(email: string, password: string): void {
  if (firebaseEnabled()) void firebaseMigrate(email, password).catch(() => undefined);
}
