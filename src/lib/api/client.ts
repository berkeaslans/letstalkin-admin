// HTTP istemcisi — Bearer access (bellekte) + tek uçuşlu refresh rotasyonu.
//
// Refresh token her kullanımda yenilenir; aynı token iki kez kullanılırsa backend
// güvenlik gereği bütün oturum ailesini düşürür. Bu yüzden yenileme hem sekme içinde
// tek uçuşludur hem de sekmeler arasında Web Locks ile sıralıdır: kilidi alan sekme,
// önceki sekmenin yazdığı YENİ token'ı localStorage'dan okuyarak yeniler.

const API_ROOT = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
export const API_BASE = `${API_ROOT}/api/v1`;
const REFRESH_KEY = 'lt_admin_refresh';

let access: string | null = null;
let onSignedOut: (() => void) | null = null;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function readRefresh(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}
function writeRefresh(v: string | null) {
  try {
    if (v) localStorage.setItem(REFRESH_KEY, v);
    else localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* gizli pencere: oturum yalnız bu sekmede yaşar */
  }
}

export const tokens = {
  set(pair: { access: string; refresh: string }) {
    access = pair.access;
    writeRefresh(pair.refresh);
  },
  clear() {
    access = null;
    writeRefresh(null);
  },
  hasRefresh: () => !!readRefresh(),
  /** Oturum düşünce (refresh reddedildi) kabuk girişe döner. */
  onSignedOut(fn: () => void) {
    onSignedOut = fn;
  },
};

let refreshing: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const refresh = readRefresh();
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) {
      // Başka sekme bu arada yenilediyse elimizdeki eski token reddedilir; yenisini dene.
      const latest = readRefresh();
      if (latest && latest !== refresh) return doRefresh();
      tokens.clear();
      return false;
    }
    tokens.set(await res.json());
    return true;
  } catch {
    return false; // ağ hatası: oturumu düşürme, bir sonraki istekte yeniden denenir
  }
}

export function refreshSession(): Promise<boolean> {
  // Kilit geri çağrısı bir Promise döndürür; request onu bekleyip sonucu iletir.
  const run = (navigator.locks ? navigator.locks.request('lt-admin-refresh', doRefresh) : doRefresh()) as Promise<boolean>;
  refreshing ??= run.finally(() => {
    refreshing = null;
  });
  return refreshing;
}

type Query = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, query?: Query) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  return `${API_BASE}${path}${s ? `?${s}` : ''}`;
}

async function parseError(res: Response): Promise<ApiError> {
  let body: { error?: string; message?: string } | null = null;
  try {
    body = await res.json();
  } catch {
    /* gövdesiz hata */
  }
  const fallback = res.status >= 500 ? 'Sunucuya ulaşılamadı, biraz sonra tekrar dene' : 'İstek tamamlanamadı';
  return new ApiError(res.status, body?.error ?? 'error', body?.message ?? fallback);
}

export async function request<T>(
  path: string,
  opts: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown; query?: Query; anonymous?: boolean } = {},
): Promise<T> {
  const send = () =>
    fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      headers: {
        ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(access && !opts.anonymous ? { authorization: `Bearer ${access}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

  if (!access && !opts.anonymous && tokens.hasRefresh()) await refreshSession();
  let res = await send();
  if (res.status === 401 && !opts.anonymous) {
    if (await refreshSession()) res = await send();
    else {
      onSignedOut?.();
      throw new ApiError(401, 'unauthorized', 'Oturumun sona erdi, yeniden giriş yap');
    }
  }
  if (!res.ok) throw await parseError(res);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body ?? {} }),
};

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Beklenmeyen bir hata oluştu');
