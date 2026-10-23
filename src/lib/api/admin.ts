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
export type AccountInfo = Res<'/api/v1/admin/users/{id}/account', 'get'>;
export type UserContent = Res<'/api/v1/admin/users/{id}/content', 'get'>;
export type ContentKind = NonNullable<Q<'/api/v1/admin/users/{id}/content'>['type']>;
export type Relations = Res<'/api/v1/admin/users/{id}/relations', 'get'>;
export type RelationKind = NonNullable<Q<'/api/v1/admin/users/{id}/relations'>['type']>;
export type ContentPage = Res<'/api/v1/admin/content', 'get'>;
export type ContentItem = ContentPage['items'][number];
export type HideKind = 'post' | 'comment' | 'room' | 'story' | 'room_message' | 'dm_message';
export type BlockedTerm = Res<'/api/v1/admin/blocklist', 'get'>[number];
export type ModSettings = Res<'/api/v1/admin/settings/moderation', 'get'>;
export type ModSummary = Res<'/api/v1/admin/moderation/summary', 'get'>;
export type RoomPage = Res<'/api/v1/admin/rooms', 'get'>;
export type RoomRow = RoomPage['items'][number];
export type RoomDetail = Res<'/api/v1/admin/rooms/{id}', 'get'>;
export type MatchRow = Res<'/api/v1/admin/match/profiles', 'get'>[number];
export type AccountType = UserRow['accountType'];
export type PublishAccounts = Res<'/api/v1/admin/publish/accounts', 'get'>;
export type PublishAccount = PublishAccounts['accounts'][number];
export type QuizPage = Res<'/api/v1/admin/quizzes', 'get'>;
export type QuizRow = QuizPage['items'][number];
export type QuizDetail = Res<'/api/v1/admin/quizzes/{id}', 'get'>;
export type QuizStatus = QuizRow['status'];
type Body<P extends keyof paths, M extends 'post' | 'put'> = paths[P][M] extends {
  requestBody?: { content: { 'application/json': infer B } };
}
  ? B
  : never;
export type PublishPost = Body<'/api/v1/admin/publish/post', 'post'>;
export type PublishRoom = Body<'/api/v1/admin/publish/room', 'post'>;
export type PublishQuiz = Body<'/api/v1/admin/publish/quiz', 'post'>;
export type QuizEdit = Body<'/api/v1/admin/quizzes/{id}', 'put'>;
export interface RoomPatch {
  name?: string;
  description?: string | null;
  privacy?: 'public' | 'requestToJoin' | 'inviteOnly';
  spoilerRule?: string | null;
  summaryEnabled?: boolean;
  closesAt?: string | null;
}
type ClearField = 'avatar' | 'cover' | 'bio' | 'displayName' | 'links';
export interface ProfilePatch {
  username?: string;
  displayName?: string | null;
  bio?: string | null;
  isPrivate?: boolean;
  birthDate?: string;
  note?: string;
}

export const authApi = {
  login: (emailOrUsername: string, password: string) =>
    request<{ access: string; refresh: string }>('/auth/login', { method: 'POST', body: { emailOrUsername, password }, anonymous: true }),
  me: () => api.get<Me>('/users/me'),
};

export const adminApi = {
  overview: () => api.get<Overview>('/admin/overview'),

  reports: (status: ReportStatus) => api.get<Report[]>('/admin/reports', { status }),
  /** Varsayılan olarak aynı hedefe bekleyen tüm şikayetler birlikte kapanır. */
  reportAction: (id: string, status: 'reviewed' | 'actioned', action: 'none' | 'hide' | 'ban', note?: string) =>
    api.post<{ ok: boolean; closed: number }>(`/admin/reports/${id}/action`, { status, action, note: note || undefined }),

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

  // Hesap
  account: (id: string) => api.get<AccountInfo>(`/admin/users/${id}/account`),
  passwordReset: (id: string, note?: string) => api.post<{ ok: boolean }>(`/admin/users/${id}/password-reset`, { note: note || undefined }),
  revokeSessions: (id: string, family?: string, note?: string) =>
    api.post<{ revoked: number }>(`/admin/users/${id}/sessions/revoke`, { family, note: note || undefined }),
  removeDevice: (id: string, deviceId: string) => request<{ ok: boolean }>(`/admin/users/${id}/devices/${deviceId}`, { method: 'DELETE' }),
  email: (id: string, action: 'mark_verified' | 'resend') => api.post<{ ok: boolean }>(`/admin/users/${id}/email`, { action }),
  clearProfile: (id: string, fields: ClearField[], note?: string) =>
    api.post<{ ok: boolean }>(`/admin/users/${id}/clear`, { fields, note: note || undefined }),
  patchProfile: (id: string, body: ProfilePatch) => request<{ ok: boolean }>(`/admin/users/${id}/profile`, { method: 'PATCH', body }),
  setAccountType: (id: string, accountType: AccountType, note?: string) =>
    api.post<{ ok: boolean }>(`/admin/users/${id}/account-type`, { accountType, note: note || undefined }),
  setTrusted: (id: string, trusted: boolean | null, note?: string) =>
    api.post<{ isTrusted: boolean }>(`/admin/users/${id}/trusted`, { trusted, note: note || undefined }),
  deletion: (id: string, action: 'request' | 'restore', note: string) =>
    api.post<{ purgeAt: string | null }>(`/admin/users/${id}/deletion`, { action, note }),
  userContent: (id: string, type: ContentKind, cursor?: string) => api.get<UserContent>(`/admin/users/${id}/content`, { type, cursor }),
  relations: (id: string, type: RelationKind) => api.get<Relations>(`/admin/users/${id}/relations`, { type }),

  // Moderasyon
  content: (p: { type: 'post' | 'comment'; q?: string; state?: 'all' | 'visible' | 'hidden'; cursor?: string }) =>
    api.get<ContentPage>('/admin/content', p),
  hide: (kind: HideKind, id: string, note?: string, notify = true) =>
    api.post<{ ok: boolean }>(`/admin/content/${kind}/${id}/hide`, { note: note || undefined, notify }),
  restore: (kind: HideKind, id: string, note?: string) =>
    api.post<{ ok: boolean }>(`/admin/content/${kind}/${id}/restore`, { note: note || undefined }),
  blocklist: () => api.get<BlockedTerm[]>('/admin/blocklist'),
  addBlocked: (kind: 'link' | 'word', pattern: string, note?: string) =>
    api.post<BlockedTerm>('/admin/blocklist', { kind, pattern, note: note || undefined }),
  removeBlocked: (id: string) => request<{ ok: boolean }>(`/admin/blocklist/${id}`, { method: 'DELETE' }),
  testBlocked: (text: string) => api.post<{ match: string | null }>('/admin/blocklist/test', { text }),
  modSettings: () => api.get<ModSettings>('/admin/settings/moderation'),
  setModSettings: (body: ModSettings) => api.put<ModSettings>('/admin/settings/moderation', body),
  modSummary: (days: number) => api.get<ModSummary>('/admin/moderation/summary', { days }),
  rooms: (p: { status: 'all' | 'active' | 'archived' | 'reported'; q?: string; cursor?: string }) => api.get<RoomPage>('/admin/rooms', p),
  room: (id: string) => api.get<RoomDetail>(`/admin/rooms/${id}`),
  roomStatus: (id: string, status: 'active' | 'archived', note?: string) =>
    api.post<{ ok: boolean }>(`/admin/rooms/${id}/status`, { status, note: note || undefined }),
  removeMember: (id: string, userId: string) => request<{ ok: boolean }>(`/admin/rooms/${id}/members/${userId}`, { method: 'DELETE' }),
  roomOwner: (id: string, userId: string, note?: string) =>
    api.post<{ ok: boolean }>(`/admin/rooms/${id}/owner`, { userId, note: note || undefined }),
  editRoom: (id: string, body: RoomPatch) => request<{ ok: boolean }>(`/admin/rooms/${id}`, { method: 'PATCH', body }),
  matchProfiles: (filter: 'all' | 'reported' | 'mismatch' | 'inactive') => api.get<MatchRow[]>('/admin/match/profiles', { filter }),
  matchActive: (userId: string, active: boolean, note?: string) =>
    api.post<{ ok: boolean }>(`/admin/match/profiles/${userId}/active`, { active, note: note || undefined }),

  // Yayın (seçilen hesap adına)
  publishAccounts: () => api.get<PublishAccounts>('/admin/publish/accounts'),
  setPublishAccounts: (userIds: string[]) => api.put<{ ok: boolean }>('/admin/publish/accounts', { userIds }),
  publishPost: (body: PublishPost) => api.post<{ id: string }>('/admin/publish/post', body),
  publishRoom: (body: PublishRoom) => api.post<{ id: string }>('/admin/publish/room', body),
  publishRoomMessage: (roomId: string, asUserId: string, text: string) =>
    api.post<{ id: string }>(`/admin/publish/room/${roomId}/message`, { asUserId, text }),
  publishQuiz: (body: PublishQuiz) => api.post<{ id: string }>('/admin/publish/quiz', body),
  quizzes: (p: { status: QuizStatus | 'all'; q?: string; cursor?: string }) => api.get<QuizPage>('/admin/quizzes', p),
  quiz: (id: string) => api.get<QuizDetail>(`/admin/quizzes/${id}`),
  editQuiz: (id: string, body: QuizEdit) => api.put<{ ok: boolean }>(`/admin/quizzes/${id}`, body),
  startQuiz: (id: string) => api.post<{ ok: boolean }>(`/admin/quizzes/${id}/start`, {}),
  endQuiz: (id: string, note?: string) => api.post<{ ok: boolean }>(`/admin/quizzes/${id}/end`, { note: note || undefined }),
  deleteQuiz: (id: string) => request<{ ok: boolean }>(`/admin/quizzes/${id}`, { method: 'DELETE' }),
  /** Görseli yükler (webp'e çevrilir), gönderiye eklenecek URL'i döner. */
  uploadImage: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<{ url: string }>('/media/upload', { method: 'POST', body: fd, query: { prefix: 'post' } });
  },

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
