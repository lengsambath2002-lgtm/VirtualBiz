import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api';

const fb = vi.hoisted(() => ({ enabled: true, token: vi.fn() }));
const api = vi.hoisted(() => ({ login: vi.fn(), firebaseSignIn: vi.fn(), firebaseMigrate: vi.fn() }));

vi.mock('@/lib/firebase', () => ({
  firebaseEnabled: () => fb.enabled,
  passwordIdToken: fb.token,
  firebaseCode: (e: { code?: string }) => e?.code ?? null,
  NOT_A_FIREBASE_LOGIN: new Set(['auth/invalid-credential']),
}));
vi.mock('../api', () => api);

import { passwordSignIn } from './passwordSignIn';

const session = { accessToken: 't', user: { id: 'u' } };
const fbError = (code: string) => Object.assign(new Error(code), { code });

describe('passwordSignIn', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fb.enabled = true;
  });

  it('checks the password itself when Firebase is not set up', async () => {
    fb.enabled = false;
    api.login.mockResolvedValue(session);
    await expect(passwordSignIn('a@b.co', 'pw')).resolves.toBe(session);
    expect(fb.token).not.toHaveBeenCalled();
  });

  it('signs in through Firebase', async () => {
    fb.token.mockResolvedValue('id-token');
    api.firebaseSignIn.mockResolvedValue(session);
    await expect(passwordSignIn('a@b.co', 'pw')).resolves.toBe(session);
    expect(api.firebaseSignIn).toHaveBeenCalledWith('id-token');
    expect(api.firebaseMigrate).not.toHaveBeenCalled();
  });

  it('moves an account made before Firebase, then signs in through Firebase', async () => {
    fb.token.mockRejectedValueOnce(fbError('auth/invalid-credential')).mockResolvedValueOnce('id-token');
    api.firebaseMigrate.mockResolvedValue(undefined);
    api.firebaseSignIn.mockResolvedValue(session);
    await expect(passwordSignIn('a@b.co', 'pw')).resolves.toBe(session);
    expect(api.firebaseMigrate).toHaveBeenCalledWith('a@b.co', 'pw');
  });

  it('a wrong password fails with the sign-in errors (tries left, lockout)', async () => {
    fb.token.mockRejectedValue(fbError('auth/invalid-credential'));
    const wrong = new ApiError('INVALID_CREDENTIALS', 401, [{ field: 'password', message: 'Wrong', meta: { reason: 'BAD_PASSWORD', triesLeft: 3 } }]);
    api.firebaseMigrate.mockRejectedValue(wrong);
    await expect(passwordSignIn('a@b.co', 'bad')).rejects.toBe(wrong);
    expect(api.firebaseSignIn).not.toHaveBeenCalled();
  });

  it('falls back to VirtualBiz when Firebase cannot be reached', async () => {
    fb.token.mockRejectedValue(fbError('auth/network-request-failed'));
    api.login.mockResolvedValue(session);
    await expect(passwordSignIn('a@b.co', 'pw')).resolves.toBe(session);
    expect(api.firebaseMigrate).not.toHaveBeenCalled();
  });
});
