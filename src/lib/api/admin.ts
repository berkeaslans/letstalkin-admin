// Yönetim uçları. Yanıt tipleri backend sözleşmesinden (contracts/openapi.json →
// schema.gen.ts) gelir; elle tip yazılmaz. Sözleşme değişince: npm run api:types.
import { api, request } from './client';
import type { paths } from './schema.gen';

type Json<T> = T extends { content: { 'application/json': infer R } } ? R : never;
export type Res<P extends keyof paths, M extends 'get' | 'post' | 'put'> = paths[P][M] extends { responses: { 200: infer R } }
  ? Json<R>
  : never;
type Q<P extends keyof paths> = paths[P]['get'] extends { parameters: { query?: infer Qr } } ? NonNullable<Qr> : never;

export type Me = Res<'/api/v1/users/me', 'get'>;
export type Overview = Res<'/api/v1/admin/overview', 'get'>;
export type Report = Res<'/api/v1/admin/reports', 'get'>[number];
export type UserPage = Res<'/api/v1/admin/users', 'get'>;
export type UserRow = UserPage['items'][number];
export type UserDetail = Res<'/api/v1/admin/users/{id}', 'get'>;
export type AuditPage = Res<'/api/v1/admin/audit', 'get'>;
export type AuditRow = AuditPage['items'][number];
export type Verification = Res<'/api/v1/admin/verifications', 'get'>[number];
export type SeriesApp = Res<'/api/v1/admin/series-pages', 'get'>[number];
export type Flag = Res<'/api/v1/admin/flags', 'get'>[number];
export type Tick = UserRow['tick'];
export type Role = UserRow['role'];
export type UserFilter = NonNullable<Q<'/api/v1/admin/users'>['filter']>;
export type ReportStatus = Report['status'];
export type AuditKind = NonNullable<Q<'/api/v1/admin/audit'>['action']>;

export const authApi = {
  login: (emailOrUsername: string, password: string) =>
    request<{ access: string; refresh: string }>('/auth/login', { method: 'POST', body: { emailOrUsername, password }, anonymous: true }),
  me: () => api.get<Me>('/users/me'),
};

export const adminApi = {
  overview: () => api.get<Overview>('/admin/overview'),

  reports: (status: ReportStatus) => api.get<Report[]>('/admin/reports', { status }),
  reportAction: (id: string, status: 'reviewed' | 'actioned', action: 'none' | 'hide' | 'ban') =>
    api.post<{ ok: boolean }>(`/admin/reports/${id}/action`, { status, action }),

  users: (p: { q?: string; filter?: UserFilter; cursor?: string }) => api.get<UserPage>('/admin/users', { ...p, limit: 30 }),
  user: (id: string) => api.get<UserDetail>(`/admin/users/${id}`),
  /** tick=null: elle verileni kaldır, otomatik hesaba dön. */
  setTick: (id: string, tick: Tick | null, note?: string) =>
    api.post<{ ok: boolean }>(`/admin/users/${id}/tick`, { tick, note: note || undefined }),
  setRole: (id: string, role: Role, note?: string) =>
    api.post<{ ok: boolean }>(`/admin/users/${id}/role`, { role, note: note || undefined }),
  setBan: (id: string, banned: boolean, note?: string) =>
    api.post<{ ok: boolean }>(`/admin/users/${id}/ban`, { banned, note: note || undefined }),
  adjustBalance: (id: string, amount: number, note: string) =>
    api.post<{ balance: number }>(`/admin/users/${id}/balance`, { amount, note }),

  audit: (p: { action?: AuditKind; targetId?: string; cursor?: string }) => api.get<AuditPage>('/admin/audit', { ...p, limit: 50 }),

  verifications: (status: 'pending_review' | 'active' | 'rejected') => api.get<Verification[]>('/admin/verifications', { status }),
  decideVerification: (userId: string, approve: boolean, note?: string) =>
    api.post<{ ok: boolean }>(`/admin/verifications/${userId}/decide`, { approve, note: note || undefined }),

  seriesPages: (status: 'pending' | 'approved' | 'rejected' | 'revoked' | 'withdrawn') =>
    api.get<SeriesApp[]>('/admin/series-pages', { status }),
  decideSeriesPage: (id: string, approve: boolean, note?: string) =>
    api.post<{ ok: boolean }>(`/admin/series-pages/${id}/decide`, { approve, note: note || undefined }),
  revokeSeriesPage: (id: string, note: string) => api.post<{ ok: boolean }>(`/admin/series-pages/${id}/revoke`, { note }),

  flags: () => api.get<Flag[]>('/admin/flags'),
  setFlag: (key: Flag['key'], enabled: boolean | null) => api.put<Flag[]>(`/admin/flags/${key}`, { enabled }),
};

/** Medya yolu → adres. Mutlak adres olduğu gibi; "/…" yollar API köküne bağlanır
 *  (web aynı alan adından servis eder, panel ayrı alan adında). */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^(https?:|blob:|data:)/.test(path)) return path;
  if (path.startsWith('/')) return `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}${path}`;
  return null;
}
