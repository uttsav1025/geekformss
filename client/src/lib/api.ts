/**
 * API client for /api/v1, built on an axios instance.
 *
 * Auth model: a short-lived access token kept ONLY in memory (never in
 * localStorage, so injected scripts can't lift a long-lived credential) plus a
 * refresh token in an httpOnly cookie the browser sends to /api/v1/auth only.
 * A 401 on a normal call triggers one shared refresh, then the call is retried.
 *
 * Responses use the envelope { success, data, message, meta?, errors? }.
 * `api.get<T>()` etc. resolve to `data`; `api.getPaged<T>()` also returns `meta`.
 * Failures reject with ApiError. Extra per-call option:
 *   anonymous: true — send no token and never try to refresh (public/auth routes)
 */
import axios, { type AxiosError, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import type { AuthSession, Meta, Paged } from '../types/api';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** true: no bearer token, no refresh-and-retry (public and auth routes). */
    anonymous?: boolean;
    /** Resolve to { data, meta } instead of data. */
    withMeta?: boolean;
    /** Resolve to the raw axios response (no envelope unwrapping). */
    skipUnwrap?: boolean;
    /** Internal: set on the single retry after a refresh. */
    _retried?: boolean;
  }
}

export interface FieldError {
  field: string;
  message: string;
}

interface Envelope<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  meta?: Meta;
  errors?: FieldError[];
}

const BASE = '/api/v1';

let accessToken: string | null = null;
export const tokenStore = {
  get: () => accessToken,
  set: (t: string | null | undefined) => {
    accessToken = t || null;
  },
};

// Tokens from before the cookie-based sessions; clear them once.
try {
  localStorage.removeItem('geekforms.token');
} catch {
  /* storage blocked */
}

export class ApiError extends Error {
  readonly status: number;
  readonly errors: FieldError[];
  /** Convenience for forms: { [field]: message } (e.g. question id -> error). */
  readonly details: Record<string, string>;

  constructor(status: number, message: string, errors?: FieldError[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors ?? [];
    this.details = Object.fromEntries(this.errors.map((e) => [e.field, e.message]));
  }
}

let onSessionLost: () => void = () => {};
export const setSessionLostHandler = (fn: () => void) => {
  onSessionLost = fn;
};

const http = axios.create({
  baseURL: BASE,
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

/** Turn any axios failure into an ApiError carrying the server's message and field errors. */
function toApiError(err: unknown): Error {
  if (err instanceof ApiError) return err;
  if (axios.isCancel(err)) return err as Error;
  if (!axios.isAxiosError<Partial<Envelope>>(err) || !err.response)
    return new ApiError(0, 'Network error, check your connection');
  const { status, data } = err.response;
  return new ApiError(status, data?.message ?? `Request failed (${status})`, data?.errors);
}

// One refresh in flight at a time: concurrent 401s all wait for the same call.
let refreshing: Promise<AuthSession> | null = null;
export function refreshSession(): Promise<AuthSession> {
  refreshing ??= http
    .post<Envelope<AuthSession>>('/auth/refresh', undefined, { anonymous: true, skipUnwrap: true })
    .then((res) => {
      tokenStore.set(res.data.data.accessToken);
      return res.data.data;
    })
    .catch((err: unknown) => {
      throw toApiError(err);
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (!config.anonymous && accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// The success handler returns the unwrapped payload, not an AxiosResponse; the
// typed `api` wrappers below are the only way callers see it.
http.interceptors.response.use(
  ((res: AxiosResponse<Envelope>) => {
    if (res.config.skipUnwrap || res.config.responseType === 'blob') return res;
    const body = res.data;
    if (body.success === false) throw new ApiError(res.status, body.message ?? 'Request failed', body.errors);
    return res.config.withMeta ? { data: body.data, meta: body.meta } : body.data;
  }) as unknown as (res: AxiosResponse) => AxiosResponse,
  async (err: AxiosError) => {
    const config = err.config;
    const expired = err.response?.status === 401 && config && !config.anonymous && !config._retried;
    // Expired access token: refresh once and retry (never for the auth routes themselves).
    if (expired && !config.url?.startsWith('/auth/')) {
      try {
        await refreshSession();
      } catch {
        tokenStore.set(null);
        onSessionLost();
        throw new ApiError(401, 'Your session has ended, please log in again');
      }
      return http({ ...config, _retried: true });
    }
    throw toApiError(err);
  },
);

type Config = Omit<AxiosRequestConfig, 'withMeta' | 'skipUnwrap' | '_retried'>;

// The interceptor already unwrapped the envelope; these casts restate that for TypeScript.
const unwrap = <T>(p: Promise<unknown>) => p as Promise<T>;

export const api = {
  get: <T>(url: string, config?: Config) => unwrap<T>(http.get(url, config)),
  getPaged: <T>(url: string, config?: Config) => unwrap<Paged<T>>(http.get(url, { ...config, withMeta: true })),
  post: <T = unknown>(url: string, body?: unknown, config?: Config) => unwrap<T>(http.post(url, body, config)),
  patch: <T = unknown>(url: string, body?: unknown, config?: Config) => unwrap<T>(http.patch(url, body, config)),
  put: <T = unknown>(url: string, body?: unknown, config?: Config) => unwrap<T>(http.put(url, body, config)),
  delete: <T = unknown>(url: string, config?: Config) => unwrap<T>(http.delete(url, config)),
};

/** Download an authenticated file (CSV export), refreshing the session if needed. */
export async function download(path: string, filename: string): Promise<void> {
  let res: AxiosResponse<Blob>;
  try {
    res = await http.get<Blob>(path, { responseType: 'blob' });
  } catch (err) {
    throw err instanceof ApiError ? err : new ApiError(0, 'Download failed');
  }
  const url = URL.createObjectURL(res.data);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Message for a caught value (catch variables are `unknown`). */
export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : 'Something went wrong');
