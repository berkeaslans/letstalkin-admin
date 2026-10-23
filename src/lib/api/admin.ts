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
export type UserSort = NonNullable<Q<'/api/v1/admin/users'>['sort']>;
export type ReportStatus = Report['status'];
export type AuditKind = NonNullable<Q<'/api/v1/admin/audit'>['action']>;
export type AuditQuery = Q<'/api/v1/admin/audit'>;
export type AuditActor = Res<'/api/v1/admin/audit/actors', 'get'>[number];
export type SearchHit = Res<'/api/v1/admin/search', 'get'>['items'][number];
export type SearchKind = SearchHit['kind'];
export type AdminNote = Res<'/api/v1/admin/users/{id}/notes', 'get'>[number];
export type SavedView = Res<'/api/v1/admin/views', 'get'>[number];
export type ViewPage = SavedView['page'];
export type ViewQuery = Record<string, string | number | boolean>;
export type BroadcastRow = Res<'/api/v1/admin/broadcasts', 'get'>[number];
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
export type Activity = Res<'/api/v1/admin/activity', 'get'>[number];
export type ActivityKind = Activity['kind'];
export type LiveNow = Res<'/api/v1/admin/live', 'get'>;
export type Audience = NonNullable<Q<'/api/v1/admin/broadcast/audience'>['audience']>;
export type EconomySummary = Res<'/api/v1/admin/economy/summary', 'get'>;
export type LedgerPage = Res<'/api/v1/admin/economy/ledger', 'get'>;
export type Subscription = Res<'/api/v1/admin/economy/subscriptions', 'get'>[number];
export type SubStatus = Subscription['status'];
export type StickerRow = Res<'/api/v1/admin/stickers', 'get'>[number];
export type StickerDetail = Res<'/api/v1/admin/stickers/{id}', 'get'>;
export type StickerBody = Body<'/api/v1/admin/stickers', 'post'>;
export type Rarity = StickerRow['rarity'];
export type ListingPage = Res<'/api/v1/admin/market/listings', 'get'>;
export type ListingStatus = ListingPage['items'][number]['status'];
export type Product = Res<'/api/v1/admin/products', 'get'>[number];
export type ProductBody = Body<'/api/v1/admin/products', 'post'>;
export type AppSettings = Res<'/api/v1/admin/settings/app', 'get'>;
export type SystemStatus = Res<'/api/v1/admin/system/status', 'get'>;
export type QueueKey = string;
export type FailedJob = Res<'/api/v1/admin/system/queues/{key}/failed', 'get'>[number];
export type ShowPage = Res<'/api/v1/admin/catalog/shows', 'get'>;
export type ShowRow = ShowPage['items'][number];
export type ShowDetail = Res<'/api/v1/admin/catalog/shows/{tmdbId}', 'get'>;
export type ShowSort = NonNullable<Q<'/api/v1/admin/catalog/shows'>['sort']>;
export type Featured = Res<'/api/v1/admin/catalog/featured', 'get'>;
export type Analytics = Res<'/api/v1/admin/analytics/overview', 'get'>;
export type GoogleStatus = Res<'/api/v1/admin/google/status', 'get'>;
export type GaReport = Res<'/api/v1/admin/google/analytics', 'get'>;
export type ScReport = Res<'/api/v1/admin/google/search', 'get'>;
export type AdsReport = Res<'/api/v1/admin/google/adsense', 'get'>;
export type FeedbackPage = Res<'/api/v1/admin/feedback', 'get'>;
export type Feedback = FeedbackPage['items'][number];
export type FeedbackStatus = Feedback['status'];
export type FeedbackKind = Feedback['kind'];
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

  users: (p: { q?: string; filter?: UserFilter; sort?: UserSort; cursor?: string; limit?: number }) =>
    api.get<UserPage>('/admin/users', { ...p, limit: p.limit ?? 30 }),
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
  uploadImage: (file: File, prefix = 'post') => {
    const fd = new FormData();
    fd.append('file', file);
    return request<{ url: string }>('/media/upload', { method: 'POST', body: fd, query: { prefix } });
  },

  // Canlı ve akış
  activity: (kind?: ActivityKind, limit = 200) => api.get<Activity[]>('/admin/activity', { kind, limit }),
  live: () => api.get<LiveNow>('/admin/live'),
  endStream: (id: string, note?: string) => api.post<{ ok: boolean }>(`/admin/live/streams/${id}/end`, { note: note || undefined }),

  // Duyuru
  audience: (audience: Audience, username?: string) =>
    api.get<{ count: number; label: string }>('/admin/broadcast/audience', { audience, username }),
  broadcast: (body: { audience: Audience; username?: string; title: string; body?: string; route?: string; scheduledAt?: string }) =>
    api.post<{ queued: number; scheduled: boolean; id: string }>('/admin/broadcast', body),

  // Geri bildirim
  feedback: (p: { status: FeedbackStatus | 'all'; kind?: FeedbackKind; q?: string; cursor?: string }) =>
    api.get<FeedbackPage>('/admin/feedback', p),
  feedbackStatus: (id: string, status: FeedbackStatus) => api.post<{ ok: boolean }>(`/admin/feedback/${id}/status`, { status }),
  feedbackReply: (id: string, text: string, resolve = true) => api.post<{ ok: boolean }>(`/admin/feedback/${id}/reply`, { text, resolve }),

  // Ekonomi
  economy: (days: number) => api.get<EconomySummary>('/admin/economy/summary', { days }),
  ledger: (p: { userId?: string; reason?: string; cursor?: string }) => api.get<LedgerPage>('/admin/economy/ledger', p),
  subscriptions: (status: SubStatus | 'all') => api.get<Subscription[]>('/admin/economy/subscriptions', { status }),
  stickers: () => api.get<StickerRow[]>('/admin/stickers'),
  sticker: (id: string) => api.get<StickerDetail>(`/admin/stickers/${id}`),
  createSticker: (body: StickerBody) => api.post<{ id: string }>('/admin/stickers', body),
  editSticker: (id: string, body: Partial<StickerBody>) => request<{ ok: boolean }>(`/admin/stickers/${id}`, { method: 'PATCH', body }),
  deleteSticker: (id: string) => request<{ ok: boolean }>(`/admin/stickers/${id}`, { method: 'DELETE' }),
  grantSticker: (id: string, username: string, note?: string) =>
    api.post<{ ok: boolean }>(`/admin/stickers/${id}/grant`, { username, note: note || undefined }),
  listings: (status: ListingStatus, cursor?: string) => api.get<ListingPage>('/admin/market/listings', { status, cursor }),
  cancelListing: (id: string, note?: string) =>
    api.post<{ ok: boolean }>(`/admin/market/listings/${id}/cancel`, { note: note || undefined }),
  products: () => api.get<Product[]>('/admin/products'),
  createProduct: (body: ProductBody) => api.post<{ id: string }>('/admin/products', body),
  editProduct: (id: string, body: Partial<ProductBody>) => request<{ ok: boolean }>(`/admin/products/${id}`, { method: 'PATCH', body }),
  deleteProduct: (id: string) => request<{ ok: boolean }>(`/admin/products/${id}`, { method: 'DELETE' }),

  // Sistem
  appSettings: () => api.get<AppSettings>('/admin/settings/app'),
  saveAppSettings: (body: Partial<Omit<AppSettings, 'envRoomThresholds'>>) => api.put<AppSettings>('/admin/settings/app', body),
  status: () => api.get<SystemStatus>('/admin/system/status'),
  failedJobs: (key: QueueKey) => api.get<FailedJob[]>(`/admin/system/queues/${key}/failed`),
  queueOp: (key: QueueKey, op: 'retry' | 'clean' | 'pause' | 'resume') =>
    api.post<{ ok: boolean; affected: number }>(`/admin/system/queues/${key}/${op}`, {}),
  runJob: (key: string) => api.post<{ ok: boolean }>(`/admin/system/jobs/${key}`, {}),

  // Katalog
  shows: (p: { q?: string; sort: ShowSort; page?: number }) => api.get<ShowPage>('/admin/catalog/shows', p),
  show: (tmdbId: string) => api.get<ShowDetail>(`/admin/catalog/shows/${tmdbId}`),
  refreshShow: (tmdbId: string) => api.post<{ ok: boolean }>(`/admin/catalog/shows/${tmdbId}/refresh`, {}),
  featured: () => api.get<Featured>('/admin/catalog/featured'),
  setFeatured: (items: Featured) => api.put<Featured>('/admin/catalog/featured', items),
  lookupShow: (tmdbId: string) => api.get<{ tmdbId: string; title: string; posterPath: string | null }>(`/admin/catalog/lookup/${tmdbId}`),

  // Analiz
  analytics: (days: number) => api.get<Analytics>('/admin/analytics/overview', { days }),
  googleStatus: () => api.get<GoogleStatus>('/admin/google/status'),
  googleAnalytics: (days: number) => api.get<GaReport>('/admin/google/analytics', { days }),
  googleSearch: (days: number) => api.get<ScReport>('/admin/google/search', { days }),
  googleAdsense: (days: number) => api.get<AdsReport>('/admin/google/adsense', { days }),

  audit: (p: AuditQuery & { cursor?: string }) => api.get<AuditPage>('/admin/audit', { ...p, limit: p.limit ?? 50 }),
  auditActors: () => api.get<AuditActor[]>('/admin/audit/actors'),
  search: (q: string) => api.get<{ items: SearchHit[] }>('/admin/search', { q }),
  notes: (id: string) => api.get<AdminNote[]>(`/admin/users/${id}/notes`),
  addNote: (id: string, text: string, pinned = false) => api.post<AdminNote[]>(`/admin/users/${id}/notes`, { text, pinned }),
  removeNote: (id: string, noteId: string) => request<AdminNote[]>(`/admin/users/${id}/notes/${noteId}`, { method: 'DELETE' }),
  views: (page?: ViewPage) => api.get<SavedView[]>('/admin/views', { page }),
  saveView: (page: ViewPage, name: string, query: ViewQuery, shared: boolean) =>
    api.post<SavedView[]>('/admin/views', { page, name, query, shared }),
  removeView: (id: string) => request<SavedView[]>(`/admin/views/${id}`, { method: 'DELETE' }),

  broadcasts: () => api.get<BroadcastRow[]>('/admin/broadcasts'),
  cancelBroadcast: (id: string) => api.post<{ ok: boolean }>(`/admin/broadcasts/${id}/cancel`, {}),
  duplicateQuiz: (id: string, body: { asUserId?: string; title?: string; startsAt?: string | null }) =>
    api.post<{ id: string }>(`/admin/quizzes/${id}/duplicate`, body),

  bulkReports: (ids: string[], status: 'reviewed' | 'actioned', action: 'none' | 'hide', note?: string) =>
    api.post<{ closed: number; hidden: number; failed: number }>('/admin/reports/bulk', { ids, status, action, note: note || undefined }),

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
