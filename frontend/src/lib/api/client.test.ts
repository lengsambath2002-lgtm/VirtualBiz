import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  apiFetch,
  fallbackErrorKey,
  isApiError,
  metaNumber,
  setAccessToken,
  setRefreshHandler,
} from './client';

const ok = <T>(data: T) =>
  new Response(JSON.stringify({ status: { code: 'SUCCESS' }, data }), { status: 200 });
const fail = (status: number, code: string, details: unknown[] = []) =>
  new Response(JSON.stringify({ status: { code }, error: { type: 'AUTH', details } }), { status });

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  setAccessToken(null);
  setRefreshHandler(null);
});
afterEach(() => vi.unstubAllGlobals());

const headersOf = (i: number) => fetchMock.mock.calls[i]![1]!.headers as Record<string, string>;

describe('apiFetch', () => {
  it('unwraps data and sends the token, business id and cookies', async () => {
    setAccessToken('t1');
    fetchMock.mockResolvedValueOnce(ok({ id: 'b1' }));
    await expect(apiFetch('/businesses/b1', { businessId: 'b1' })).resolves.toEqual({ id: 'b1' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/businesses/b1');
    expect(init?.credentials).toBe('include');
    expect(headersOf(0).Authorization).toBe('Bearer t1');
    expect(headersOf(0)['X-Business-Id']).toBe('b1');
  });

  it('throws ApiError with the status code name, details and meta', async () => {
    fetchMock.mockResolvedValueOnce(
      fail(401, 'INVALID_CREDENTIALS', [
        { field: 'password', message: 'bad', meta: { reason: 'BAD_PASSWORD', triesLeft: 3 } },
      ]),
    );
    const err = await apiFetch('/auth/login', { method: 'POST', body: {}, auth: false }).catch(
      (e: unknown) => e,
    );
    expect(isApiError(err, 'INVALID_CREDENTIALS')).toBe(true);
    const e = err as ApiError;
    expect(e.status).toBe(401);
    expect(e.meta('reason')).toBe('BAD_PASSWORD');
    expect(metaNumber(e, 'triesLeft', 0)).toBe(3);
    expect(e.field('password')?.message).toBe('bad');
  });

  it('refreshes once on a stale token and retries', async () => {
    setAccessToken('old');
    const refresher = vi.fn(async () => {
      setAccessToken('new');
      return 'new';
    });
    setRefreshHandler(refresher);
    fetchMock.mockResolvedValueOnce(fail(401, 'INVALID_TOKEN')).mockResolvedValueOnce(ok([1]));
    await expect(apiFetch('/me/addresses')).resolves.toEqual([1]);
    expect(refresher).toHaveBeenCalledTimes(1);
    expect(headersOf(1).Authorization).toBe('Bearer new');
  });

  it('does not retry when the refresh fails', async () => {
    setAccessToken('old');
    setRefreshHandler(async () => null);
    fetchMock.mockResolvedValueOnce(fail(401, 'INVALID_TOKEN'));
    await expect(apiFetch('/me')).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not refresh for other 401s (wrong password)', async () => {
    const refresher = vi.fn(async () => 'x');
    setRefreshHandler(refresher);
    fetchMock.mockResolvedValueOnce(fail(401, 'INVALID_CREDENTIALS'));
    await expect(apiFetch('/me/password', { method: 'POST', body: {} })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    // One refresh before the call (no token yet), none after the 401.
    expect(refresher).toHaveBeenCalledTimes(1);
  });

  it('turns a failed fetch into NETWORK_ERROR', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const err = await apiFetch('/auth/lookup', { auth: false }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(fallbackErrorKey(err)).toBe('errors.network');
    expect(fallbackErrorKey(new ApiError('INTERNAL_ERROR', 500))).toBe('errors.generic');
  });

  it('accepts an empty body (logout)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    await expect(
      apiFetch('/auth/logout', { method: 'POST', auth: false }),
    ).resolves.toBeUndefined();
  });
});
