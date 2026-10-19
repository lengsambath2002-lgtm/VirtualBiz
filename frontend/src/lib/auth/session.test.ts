import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAccessToken, refreshAccessToken, setAccessToken } from '@/lib/api';
import type { User } from '@/lib/domain';

import { useSessionStore } from './session';

const user: User = {
  id: 'u1',
  name: 'Kry Sonita',
  email: 'nita@virtualbiz.com',
  signInMethods: ['PASSWORD'],
  createdAt: '2026-01-01T00:00:00Z',
};
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  setAccessToken(null);
  useSessionStore.setState({ user: null, method: null, validated: false });
  localStorage.clear();
});

describe('session', () => {
  it('signIn keeps the token in memory and persists only the user', () => {
    useSessionStore.getState().signIn({ accessToken: 'tok', expiresIn: 900, user }, 'PASSWORD');
    expect(getAccessToken()).toBe('tok');
    const stored = JSON.parse(localStorage.getItem('vb-session') ?? '{}');
    expect(stored.state.user.email).toBe(user.email);
    expect(JSON.stringify(stored)).not.toContain('tok');
  });

  it('signOut clears locally and calls /api/auth/logout', async () => {
    useSessionStore.getState().signIn({ accessToken: 'tok', expiresIn: 900, user });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    await useSessionStore.getState().signOut();
    expect(useSessionStore.getState().user).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/auth/logout');
  });

  it('a failed refresh signs the persisted user out', async () => {
    useSessionStore.setState({ user });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: { code: 'REFRESH_TOKEN_INVALID' } }), { status: 401 }),
    );
    await expect(refreshAccessToken()).resolves.toBeNull();
    expect(useSessionStore.getState().user).toBeNull();
  });

  it('a good refresh stores the new token and user', async () => {
    useSessionStore.setState({ user });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: { code: 'SUCCESS' },
          data: { accessToken: 'fresh', expiresIn: 900, user: { ...user, name: 'Sonita' } },
        }),
        { status: 200 },
      ),
    );
    await expect(refreshAccessToken()).resolves.toBe('fresh');
    expect(getAccessToken()).toBe('fresh');
    expect(useSessionStore.getState().user?.name).toBe('Sonita');
  });

  it('never refreshes for a signed-out visitor', async () => {
    await expect(refreshAccessToken()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
