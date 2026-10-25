// HTTP istemcisi — Bearer access (bellekte) + tek uçuşlu refresh rotasyonu.
//
// Refresh token JavaScript'e HİÇ görünmez: backend onu yalnız /api/v1/auth yoluna giden
// HttpOnly + Secure + SameSite=Strict çerezde tutar (X-Refresh-Cookie: 1). Eskiden 30 gün
// localStorage'daydı; panelde tek bir XSS ya da kötü niyetli paket yönetici oturumunu
// çalabilirdi. localStorage'da yalnız "oturum var" işareti (sır değil) durur.
//
// Refresh her kullanımda yenilenir; aynı token iki kez kullanılırsa backend bütün oturum
// ailesini düşürür. Bu yüzden yenileme sekme içinde tek uçuşlu, sekmeler arasında Web Locks
// ile sıralıdır (çerez ortak: kilidi alan sekme bir öncekinin yazdığı yeni çerezle yeniler).

const API_ROOT = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
export const API_BASE = `${API_ROOT}/api/v1`;
const SESSION_KEY = 'lt_admin_session';
/** Eski sürümün localStorage'daki refresh token'ı: ilk açılışta bir kez çereze taşınıp silinir. */
const LEGACY_KEY = 'lt_admin_refresh';
/** Kimlik uçlarına giden her istekte: refresh çerezde dönsün/okunsun. */
const COOKIE_MODE = { 'x-refresh-cookie': '1' } as const;

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

function store(key: string, v: string | null) {
  try {
    if (v) localStorage.setItem(key, v);
    else localStorage.removeItem(key);
  } catch {
    /* gizli pencere: oturum yalnız bu sekmede yaşar */
  }
}
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export const tokens = {
  /** Giriş/yenileme yanıtı: access bellekte; refresh zaten çerezde (gövdede boş gelir). */
  set(pair: { access: string }) {
    access = pair.access;
    store(SESSION_KEY, '1');
  },
  clear() {
    access = null;
    store(SESSION_KEY, null);
    store(LEGACY_KEY, null);
  },
  hasRefresh: () => !!read(SESSION_KEY) || !!read(LEGACY_KEY),
  /** Gerçek zamanlı bağlantının el sıkışması için güncel access token. */
  access: () => access,
  /** Oturum düşünce (refresh reddedildi) kabuk girişe döner. */
  onSignedOut(fn: () => void) {
    onSignedOut = fn;
  },
};

let refreshing: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  if (!tokens.hasRefresh()) return false;
  // Eski sürümden kalan token (bir kez) gövdede gider; yanıt onu çereze yazar, sonra silinir.
  const legacy = read(LEGACY_KEY);
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', ...COOKIE_MODE },
      body: JSON.stringify(legacy ? { refresh: legacy } : {}),
    });
    if (!res.ok) {
      tokens.clear();
      return false;
    }
    store(LEGACY_KEY, null);
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
  opts: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; query?: Query; anonymous?: boolean } = {},
): Promise<T> {
  // FormData (dosya yükleme) olduğu gibi gider; tarayıcı multipart sınırını kendi yazar.
  const form = opts.body instanceof FormData;
  const auth = path.startsWith('/auth/');
  const send = () =>
    fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      // Kimlik uçları refresh çerezini taşır (çerez yalnız /api/v1/auth yoluna gider).
      ...(auth ? { credentials: 'include' as const } : {}),
      headers: {
        ...(auth ? COOKIE_MODE : {}),
        ...(opts.body !== undefined && !form ? { 'content-type': 'application/json' } : {}),
        ...(access && !opts.anonymous ? { authorization: `Bearer ${access}` } : {}),
      },
      body: form ? (opts.body as FormData) : opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
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
