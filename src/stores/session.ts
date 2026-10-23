import { create } from 'zustand';
import { authApi, type Me } from '@/lib/api/admin';
import { tokens } from '@/lib/api/client';

type Status = 'loading' | 'signedOut' | 'forbidden' | 'ready';

interface SessionState {
  status: Status;
  me: Me | null;
  /** Açılışta: elde refresh varsa oturumu geri yükle ve rolü doğrula. */
  boot: () => Promise<void>;
  login: (id: string, password: string) => Promise<void>;
  logout: () => void;
}

const isStaff = (me: Me) => me.role === 'admin' || me.role === 'moderator';

export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  me: null,
  async boot() {
    if (!tokens.hasRefresh()) return set({ status: 'signedOut' });
    try {
      const me = await authApi.me();
      set({ me, status: isStaff(me) ? 'ready' : 'forbidden' });
    } catch {
      set({ status: 'signedOut' });
    }
  },
  async login(id, password) {
    tokens.set(await authApi.login(id, password));
    const me = await authApi.me();
    set({ me, status: isStaff(me) ? 'ready' : 'forbidden' });
  },
  logout() {
    tokens.clear();
    set({ me: null, status: 'signedOut' });
  },
}));

tokens.onSignedOut(() => useSession.setState({ me: null, status: 'signedOut' }));

export const useIsAdmin = () => useSession((s) => s.me?.role === 'admin');
