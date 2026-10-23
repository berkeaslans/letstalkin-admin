// Klavye kısayolları. Panelin her yerinde geçerli; yazı yazarken devre dışı.
//  ⌘K / Ctrl+K · komut paleti        ?  · kısayol yardımı
//  g sonra harf · bölüme git          Esc · kapat
// Sayfaların kendi kısayolları (ör. şikayet kuyruğunda j/k) useKeys ile eklenir.
import { useEffect } from 'react';
import { create } from 'zustand';

export const useOverlay = create<{ palette: boolean; help: boolean }>(() => ({ palette: false, help: false }));
export const openPalette = () => useOverlay.setState({ palette: true, help: false });
export const closeOverlays = () => useOverlay.setState({ palette: false, help: false });

/** Odak bir yazı alanındaysa harf kısayolları çalışmamalı. */
export function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** "g" sonra basılan harf → gidilecek adres. */
export const GO_TO: Array<{ key: string; to: string; label: string }> = [
  { key: 'g', to: '/', label: 'Genel bakış' },
  { key: 'c', to: '/canli', label: 'Canlı' },
  { key: 'm', to: '/moderasyon', label: 'Şikayetler' },
  { key: 'u', to: '/kullanicilar', label: 'Kullanıcılar' },
  { key: 'y', to: '/yayin', label: 'Yeni yayın' },
  { key: 'k', to: '/katalog', label: 'Katalog' },
  { key: 'e', to: '/ekonomi', label: 'Ekonomi' },
  { key: 'a', to: '/analiz', label: 'Analiz' },
  { key: 's', to: '/sistem', label: 'Sistem' },
  { key: 'd', to: '/sistem/denetim', label: 'Denetim kaydı' },
  { key: 'b', to: '/moderasyon/geri-bildirim', label: 'Geri bildirim' },
];

/** Sayfaya özel kısayol: tuş → iş. `when` false ise bağlanmaz. */
export function useKeys(map: Record<string, (e: KeyboardEvent) => void>, when = true) {
  useEffect(() => {
    if (!when) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const fn = map[e.key.toLowerCase()];
      if (fn) {
        e.preventDefault();
        fn(e);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
}

/** Kabukta bir kez bağlanır: palet, yardım ve "g" ile gitme. */
export function useGlobalShortcuts(navigate: (to: string) => void) {
  useEffect(() => {
    let awaitingGo = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        useOverlay.setState((s) => ({ palette: !s.palette, help: false }));
        return;
      }
      if (e.key === 'Escape') return closeOverlays();
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '?') {
        e.preventDefault();
        useOverlay.setState((s) => ({ help: !s.help, palette: false }));
        return;
      }
      if (awaitingGo) {
        awaitingGo = false;
        clearTimeout(timer);
        const hit = GO_TO.find((g) => g.key === e.key.toLowerCase());
        if (hit) {
          e.preventDefault();
          navigate(hit.to);
        }
        return;
      }
      if (e.key.toLowerCase() === 'g') {
        awaitingGo = true;
        timer = setTimeout(() => {
          awaitingGo = false;
        }, 1200);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(timer);
    };
  }, [navigate]);
}

/** Mac'te ⌘, diğerlerinde Ctrl. */
export const META = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
