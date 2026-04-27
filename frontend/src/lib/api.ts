/* Lightweight fetch wrapper for the Laravel API.
 * Token is stored in localStorage; cookies are also sent for Sanctum stateful flows.
 */

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

function token(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('pms_token');
}

export type ApiError = { message: string; errors?: Record<string, string[]> };

async function request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (!(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const t = token();
  if (t) headers.set('Authorization', `Bearer ${t}`);

  const res = await fetch(`${API}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (res.status === 202) {
    return (await res.json()) as T; // offline queued
  }
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err: ApiError = { message: data?.message || `HTTP ${res.status}`, errors: data?.errors };
    throw err;
  }
  return data as T;
}

export const api = {
  get:    <T = unknown>(p: string)               => request<T>(p),
  post:   <T = unknown>(p: string, body?: unknown) => request<T>(p, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body ?? {}) }),
  put:    <T = unknown>(p: string, body?: unknown) => request<T>(p, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  patch:  <T = unknown>(p: string, body?: unknown) => request<T>(p, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: <T = unknown>(p: string)               => request<T>(p, { method: 'DELETE' }),
};

export function setToken(t: string | null) {
  if (typeof window === 'undefined') return;
  if (t) localStorage.setItem('pms_token', t);
  else localStorage.removeItem('pms_token');
}
