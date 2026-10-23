'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  ApiError,
  apiFetch,
  refreshAccessToken,
  setAccessToken,
  setRefreshHandler,
  type AuthSession,
} from '@/lib/api';
import type { SignInMethod, User } from '@/lib/domain';
import { firebaseSignOut } from '@/lib/firebase/auth';
import { forgetPushOnSignOut } from '@/lib/firebase/usePush';

/**
 * Client session shared by every surface (sign-in, customer, seller, provider).
 *
 * - The access token is kept in memory only (`@/lib/api`); the refresh token is an httpOnly
 *   cookie the browser sends to `/api/auth/*`.
 * - The user is persisted (`vb-session`) so the first paint can show who is signed in, then
 *   validated on app start by `POST /api/auth/refresh`; a failed refresh signs out.
 */
interface SessionState {
  user: User | null;
  method: SignInMethod | null;
  /** The persisted user was checked against the server this page load (in memory only). */
  validated: boolean;
  /** Store the session an auth endpoint returned (token in memory, user persisted). */
  signIn: (session: AuthSession, method?: SignInMethod) => void;
  updateUser: (patch: Partial<User>) => void;
  /** Sign out on this browser (`POST /api/auth/logout` clears the refresh cookie). */
  signOut: () => Promise<void>;
  /** Sign out of every device (`POST /api/auth/logout-all`). */
  signOutEverywhere: () => Promise<void>;
  /** Forget the local session without calling the server (refresh failed). */
  clear: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      user: null,
      method: null,
      validated: false,
      signIn: (session, method) => {
        setAccessToken(session.accessToken);
        set({ user: session.user, method: method ?? get().method, validated: true });
      },
      updateUser: (patch) => set((s) => (s.user ? { user: { ...s.user, ...patch } } : s)),
      signOut: async () => {
        // While still signed in: this browser stops getting the account's push notifications.
        await Promise.race([forgetPushOnSignOut(), new Promise((r) => setTimeout(r, 1500))]);
        setAccessToken(null);
        set({ user: null, method: null, validated: true });
        void firebaseSignOut();
        try {
          await apiFetch<void>('/auth/logout', { method: 'POST', auth: false });
        } catch {
          /* already signed out on the server, or offline: the local session is gone anyway */
        }
      },
      signOutEverywhere: async () => {
        try {
          await apiFetch<void>('/auth/logout-all', { method: 'POST' });
        } finally {
          await get().signOut();
        }
      },
      clear: () => {
        setAccessToken(null);
        set({ user: null, method: null, validated: true });
      },
    }),
    {
      name: 'vb-session',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ user, method }) => ({ user, method }),
    },
  ),
);

/**
 * `POST /api/auth/refresh`: a new access token from the cookie, or null. Only the server saying
 * no (401 / 403: expired, revoked or suspended) signs the user out. A request that never got an
 * answer (offline, or cut off because the user moved to another page) or a server error keeps
 * the session: the next request tries again.
 */
async function refresh(): Promise<string | null> {
  try {
    const session = await apiFetch<AuthSession>('/auth/refresh', { method: 'POST', auth: false });
    useSessionStore.getState().signIn(session);
    return session.accessToken;
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (e.status === 401 || e.status === 403) useSessionStore.getState().clear();
    return null;
  }
}

// The API client calls this on a stale token. Only refresh while someone is signed in, so a
// signed-out visitor never makes the cookie sign them back in.
setRefreshHandler(() => (useSessionStore.getState().user ? refresh() : Promise.resolve(null)));

let validation: Promise<void> | null = null;

/** Once per page load: check the persisted user with the server. */
function validate(): Promise<void> {
  validation ??= (async () => {
    if (!useSessionStore.getState().user) {
      useSessionStore.setState({ validated: true });
      return;
    }
    await refreshAccessToken();
    useSessionStore.setState({ validated: true });
  })();
  return validation;
}

/**
 * Read the session safely from components. Rehydrates from localStorage after mount, so
 * server and first client render agree (`ready` is false until then), then validates it.
 */
export function useSession() {
  const state = useSessionStore();
  // `persist` is missing during server rendering (no localStorage), so every access is guarded.
  const [ready, setReady] = useState(() => useSessionStore.persist?.hasHydrated() ?? false);

  useEffect(() => {
    const api = useSessionStore.persist;
    if (!api) return;
    if (api.hasHydrated()) {
      setReady(true);
      void validate();
      return;
    }
    const unsub = api.onFinishHydration(() => {
      setReady(true);
      void validate();
    });
    void api.rehydrate();
    return unsub;
  }, []);

  return { ...state, ready, signedIn: ready && state.user !== null };
}
