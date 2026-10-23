// Gerçek zamanlı katman: backend'in 'admin' Socket.IO kanalına bağlanır.
// Uygulamada olan her önemli şey (kayıt, gönderi, şikayet, oda, satış...) anında
// gelir: akışa eklenir, ilgili ekranların verisi tazelenir, kritik olanlarda
// ses + bildirim çıkar. Sayfa yenilemek gerekmez.
import type { QueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { create } from 'zustand';
import { type Activity, type ActivityKind, adminApi } from '@/lib/api/admin';
import { refreshSession, tokens } from '@/lib/api/client';
import { playSound } from '@/lib/sound';
import { toast } from '@/stores/ui';

const API_ROOT = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const MAX = 400;

interface LiveState {
  status: 'connecting' | 'live' | 'offline';
  events: Activity[];
  /** Son 60 sn'de gelen olay sayısı (nabız göstergesi). */
  unseen: number;
}
export const useLive = create<LiveState>(() => ({ status: 'connecting', events: [], unseen: 0 }));

/** Olay türü → tazelenecek sorgular. */
const INVALIDATE: Record<ActivityKind, string[][]> = {
  signup: [
    ['admin', 'users'],
    ['admin', 'overview'],
    ['admin', 'analytics'],
  ],
  post: [
    ['admin', 'content'],
    ['admin', 'analytics'],
  ],
  comment: [['admin', 'content']],
  report: [
    ['admin', 'reports'],
    ['admin', 'overview'],
    ['admin', 'modsummary'],
  ],
  room: [
    ['admin', 'rooms'],
    ['admin', 'live'],
  ],
  quiz: [
    ['admin', 'quizzes'],
    ['admin', 'live'],
    ['admin', 'overview'],
  ],
  live: [
    ['admin', 'live'],
    ['admin', 'overview'],
  ],
  trade: [
    ['admin', 'listings'],
    ['admin', 'economy'],
    ['admin', 'stickers'],
  ],
  verification: [
    ['admin', 'verifications'],
    ['admin', 'overview'],
  ],
  series_page: [
    ['admin', 'series-pages'],
    ['admin', 'overview'],
  ],
  feedback: [
    ['admin', 'feedback'],
    ['admin', 'overview'],
  ],
  deletion: [['admin', 'users']],
  admin: [['admin', 'audit']],
};
/** Ekibin hemen bakması gerekenler: ses + bildirim. */
const ALERT: Partial<Record<ActivityKind, [string, 'alert' | 'success']>> = {
  report: ['Yeni şikayet', 'alert'],
  verification: ['Yeni mavi tik başvurusu', 'success'],
  series_page: ['Yeni dizi sayfası başvurusu', 'success'],
  feedback: ['Yeni geri bildirim', 'success'],
  live: ['Canlı yayın başladı', 'success'],
};

let socket: Socket | null = null;

export function startRealtime(qc: QueryClient) {
  if (socket) return;
  useLive.setState({ status: 'connecting' });
  // Geçmiş: son olaylar (bağlanmadan önce olanlar da görünsün).
  adminApi
    .activity(undefined, 200)
    .then((rows) => useLive.setState((s) => ({ events: mergeEvents(s.events, rows) })))
    .catch(() => {});

  socket = io(API_ROOT || window.location.origin, {
    transports: ['websocket'],
    auth: (cb) => cb({ token: tokens.access() }),
    reconnectionDelayMax: 10_000,
  });
  socket.on('connect', () => {
    socket?.emit('admin:join');
    useLive.setState({ status: 'live' });
  });
  socket.on('disconnect', () => useLive.setState({ status: 'offline' }));
  const reauth = async () => {
    // Access token süresi doldu: yenileyip yeniden bağlan.
    if (await refreshSession()) socket?.connect();
    else useLive.setState({ status: 'offline' });
  };
  socket.on('connect_error', (e) => {
    useLive.setState({ status: 'offline' });
    if (e.message === 'unauthorized') void reauth();
  });
  socket.on('auth:expired', () => void reauth());

  socket.on('admin:event', (ev: Activity) => {
    useLive.setState((s) => ({ events: [ev, ...s.events].slice(0, MAX), unseen: s.unseen + 1 }));
    setTimeout(() => useLive.setState((s) => ({ unseen: Math.max(0, s.unseen - 1) })), 60_000);
    for (const key of INVALIDATE[ev.kind] ?? []) void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ['admin', 'activity'] });
    const alert = ALERT[ev.kind];
    if (alert) {
      toast(alert[0], alert[1], ev.text);
      playSound(alert[1] === 'alert' ? 'alert' : 'ok');
    }
  });
}

export function stopRealtime() {
  socket?.disconnect();
  socket = null;
  useLive.setState({ status: 'offline', events: [], unseen: 0 });
}

function mergeEvents(cur: Activity[], older: Activity[]) {
  const seen = new Set(cur.map((e) => `${e.at}|${e.text}`));
  return [...cur, ...older.filter((e) => !seen.has(`${e.at}|${e.text}`))].slice(0, MAX);
}

/** Oda mesajı (backend'in room:message yayını). */
export interface RoomMessage {
  id: string;
  text: string;
  createdAt: string;
  author: { id: string; username: string; displayName: string | null; avatarPath: string | null; tick: 'none' | 'yellow' | 'blue' } | null;
}

/**
 * Bir odayı canlı izler: ekip üye olmadan da dinleyebilir (admin:room:join).
 * Gelen her mesaj `onMessage`'a düşer. Dönen fonksiyon aboneliği bırakır.
 */
export function watchRoom(roomId: string, onMessage: (m: RoomMessage) => void): () => void {
  const s = socket;
  if (!s) return () => {};
  const join = () => s.emit('admin:room:join', roomId);
  // Bağlantı kopup geri gelirse yeniden katıl.
  s.on('connect', join);
  if (s.connected) join();
  const handler = (m: RoomMessage) => onMessage(m);
  s.on('room:message', handler);
  return () => {
    s.off('room:message', handler);
    s.off('connect', join);
    s.emit('room:leave', roomId);
  };
}
