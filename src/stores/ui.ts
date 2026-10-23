import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info' | 'alert';
interface Toast {
  id: number;
  text: string;
  sub?: string;
  kind: ToastKind;
}
interface ConfirmReq {
  title: string;
  body: string;
  ok: string;
  danger?: boolean;
  /** Gerekçe alanı gösterilsin mi; true ise boş geçilemez. */
  note?: 'optional' | 'required';
  resolve: (v: { ok: boolean; note: string }) => void;
}

function pref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function savePref(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* tercih kaydedilemedi — oturum içinde geçerli kalır */
  }
}

interface UiState {
  toasts: Toast[];
  confirm: ConfirmReq | null;
  sound: boolean;
  mini: boolean;
  setSound: (v: boolean) => void;
  setMini: (v: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
  toasts: [],
  confirm: null,
  sound: pref('lt_admin_sound', true),
  mini: pref('lt_admin_mini', false),
  setSound: (sound) => {
    savePref('lt_admin_sound', sound);
    set({ sound });
  },
  setMini: (mini) => {
    savePref('lt_admin_mini', mini);
    set({ mini });
  },
}));

let seq = 0;
export function toast(text: string, kind: ToastKind = 'success', sub?: string) {
  const id = ++seq;
  useUi.setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, sub, kind }] }));
  setTimeout(() => useUi.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
}

/** Sayfa içi onay (tarayıcı confirm() yerine). */
export function confirmAction(req: Omit<ConfirmReq, 'resolve'>): Promise<{ ok: boolean; note: string }> {
  return new Promise((resolve) => useUi.setState({ confirm: { ...req, resolve } }));
}
