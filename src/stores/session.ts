import { create } from 'zustand';
import { authApi, type Me, type TwoFactorChallenge } from '@/lib/api/admin';
import { tokens } from '@/lib/api/client';

/** needs2fa: ekip hesabı ama iki adımlı doğrulama kapalı — backend yönetim uçlarını 403 ile kapatır. */
type Status = 'loading' | 'signedOut' | 'forbidden' | 'needs2fa' | 'ready';

interface SessionState {
  status: Status;
  me: Me | null;
  /** Açılışta: elde refresh varsa oturumu geri yükle ve rolü doğrula. */
  boot: () => Promise<void>;
  /** İkinci adım gerekiyorsa giriş anahtarını döndürür (oturum henüz açılmadı). */
  login: (id: string, password: string) => Promise<TwoFactorChallenge | null>;
  completeTwoFactor: (challenge: string, method: 'totp' | 'email' | 'recovery', code: string) => Promise<void>;
  logout: () => void;
}

const isStaff = (me: Me) => me.role === 'admin' || me.role === 'moderator';
const statusOf = (me: Me): Status => (!isStaff(me) ? 'forbidden' : me.twoFactorEnabled === false ? 'needs2fa' : 'ready');

export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  me: null,
  async boot() {
    if (!tokens.hasRefresh()) return set({ status: 'signedOut' });
    try {
      const me = await authApi.me();
      set({ me, status: statusOf(me) });
    } catch {
      set({ status: 'signedOut' });
    }
  },
  async login(id, password) {
    const res = await authApi.login(id, password);
    if ('twoFactor' in res) return res.twoFactor;
    tokens.set(res);
    const me = await authApi.me();
    set({ me, status: statusOf(me) });
    return null;
  },
  async completeTwoFactor(challenge, method, code) {
    tokens.set(await authApi.twoFactorLogin(challenge, method, code));
    const me = await authApi.me();
    set({ me, status: statusOf(me) });
  },
  logout() {
    // Çerezdeki refresh sunucuda iptal edilir ve silinir (yerelde de işaret temizlenir).
    void authApi.logout().catch(() => {});
    tokens.clear();
    set({ me: null, status: 'signedOut' });
  },
}));

tokens.onSignedOut(() => useSession.setState({ me: null, status: 'signedOut' }));

export const useIsAdmin = () => useSession((s) => s.me?.role === 'admin');
