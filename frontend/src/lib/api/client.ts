// Typed fetch wrapper for the VirtualBiz API (docs/api/phase1-auth-account-business.md).
// Every response is the `ApiResponse` envelope; failures throw `ApiError` with the
// `StatusCode` name, which the UI translates (never `status.message`).

/** One problem in `error.details`: the field it is about, a developer message and extra data. */
export interface ApiErrorDetail {
  field?: string | null;
  message?: string | null;
  meta?: Record<string, unknown> | null;
}

/** The single response envelope: `{status, data, common, error}`. */
export interface ApiResponse<T> {
  status: { code: string; message?: string };
  data?: T | null;
  common?: { requestId?: string; timestamp?: string };
  error?: { type?: string; details?: ApiErrorDetail[] | null } | null;
}

/** Codes the client produces itself (no envelope to read one from). */
export const NETWORK_ERROR = 'NETWORK_ERROR';
export const BAD_RESPONSE = 'BAD_RESPONSE';

export class ApiError extends Error {
  readonly code: string;
  /** HTTP status (0 when the request never got a response). */
  readonly status: number;
  readonly details: ApiErrorDetail[];
  readonly requestId: string | undefined;

  constructor(code: string, status: number, details: ApiErrorDetail[] = [], requestId?: string) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }

  /** A `meta` value from the first detail that carries it. */
  meta<T = unknown>(key: string): T | undefined {
    for (const d of this.details) {
      if (d.meta && key in d.meta) return d.meta[key] as T;
    }
    return undefined;
  }

  /** The detail about one request field, if any. */
  field(name: string): ApiErrorDetail | undefined {
    return this.details.find((d) => d.field === name);
  }
}

export const isApiError = (e: unknown, ...codes: string[]): e is ApiError =>
  e instanceof ApiError && (codes.length === 0 || codes.includes(e.code));

/** A `meta` number (seconds, tries left…) from an error, or the fallback. */
export function metaNumber(e: unknown, key: string, fallback: number): number {
  if (!(e instanceof ApiError)) return fallback;
  const v = Number(e.meta(key));
  return Number.isFinite(v) ? v : fallback;
}

// ---- access token ---------------------------------------------------------------------

/** The access token lives in memory only (never localStorage); a reload refreshes it. */
let accessToken: string | null = null;
export const getAccessToken = () => accessToken;
export function setAccessToken(token: string | null) {
  accessToken = token;
}

/**
 * Gets a fresh access token from the refresh cookie (or null when signed out). Registered by
 * the session module so the client never imports the store.
 */
type Refresher = () => Promise<string | null>;
let refresher: Refresher | null = null;
let inflight: Promise<string | null> | null = null;

export function setRefreshHandler(fn: Refresher | null) {
  refresher = fn;
}

/** Refresh once at a time: concurrent 401s share one `/api/auth/refresh` (it rotates the cookie). */
export function refreshAccessToken(): Promise<string | null> {
  if (!refresher) return Promise.resolve(null);
  inflight ??= refresher().finally(() => {
    inflight = null;
  });
  return inflight;
}

// ---- requests -------------------------------------------------------------------------

/** `/api` on this origin (Next rewrites it to the backend); NEXT_PUBLIC_API_BASE_URL overrides. */
export const API_BASE = `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ''}/api`;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Sent as `X-Business-Id` (merchant endpoints). */
  businessId?: string;
  /** Attach the bearer token (default true). Auth endpoints that use the cookie pass false. */
  auth?: boolean;
  /** Extra request headers (e.g. `Idempotency-Key`). */
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/** 401 codes that mean "the access token is missing or stale": refresh and retry once. */
const RETRY_CODES = ['INVALID_TOKEN', 'UNAUTHORIZED'];

async function send(path: string, opts: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
  // FormData (file uploads) sets its own multipart Content-Type with the boundary.
  const form = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  if (opts.body !== undefined && !form) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.businessId) headers['X-Business-Id'] = opts.businessId;
  try {
    return await fetch(`${API_BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body:
        opts.body === undefined
          ? undefined
          : form
            ? (opts.body as FormData)
            : JSON.stringify(opts.body),
      credentials: 'include',
      signal: opts.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(NETWORK_ERROR, 0);
  }
}

async function read<T>(res: Response): Promise<T> {
  let env: ApiResponse<T> | null = null;
  const text = await res.text();
  if (text) {
    try {
      env = JSON.parse(text) as ApiResponse<T>;
    } catch {
      env = null;
    }
  }
  if (res.ok && (!text || env)) return (env?.data ?? undefined) as T;
  const code = env?.status?.code ?? (res.ok ? BAD_RESPONSE : `HTTP_${res.status}`);
  throw new ApiError(code, res.status, env?.error?.details ?? [], env?.common?.requestId);
}

/**
 * Call the API and return `data`. Throws `ApiError`. A 401 for a stale token triggers one
 * refresh and one retry; if the refresh fails the session handler signs the user out.
 */
export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const auth = opts.auth ?? true;
  // A reload has no token yet: wait for the session's refresh instead of a certain 401.
  if (auth && !accessToken && (inflight || refresher)) await refreshAccessToken();
  const res = await send(path, opts, auth ? accessToken : null);
  if (res.status === 401 && auth) {
    let code: string | undefined;
    try {
      code = ((await res.clone().json()) as ApiResponse<unknown>).status?.code;
    } catch {
      code = undefined;
    }
    if (!code || RETRY_CODES.includes(code)) {
      const token = await refreshAccessToken();
      if (token) return read<T>(await send(path, opts, token));
    }
  }
  return read<T>(res);
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...opts, method: 'DELETE' }),
  /** Multipart POST (file uploads). */
  upload: <T>(path: string, form: FormData, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...opts, method: 'POST', body: form }),
};

/** `common.errors.*` key for an error no screen handles specifically. */
export const fallbackErrorKey = (
  e: unknown,
): 'errors.network' | 'errors.generic' | 'errors.suspended' =>
  e instanceof ApiError && e.code === NETWORK_ERROR
    ? 'errors.network'
    : // A suspended account is told so by every sign-in method (docs/api/phase7-admin.md).
      e instanceof ApiError && e.code === 'ACCOUNT_SUSPENDED'
      ? 'errors.suspended'
      : 'errors.generic';
