import { useUi } from '@/stores/ui';

// Kısa, sentezlenmiş bildirim sesleri (dosya yok). Tarayıcı kuralı gereği ses,
// kullanıcı sayfayla bir kez etkileşince açılır; öncesinde sessizce atlanır.
let ctx: AudioContext | null = null;
const SEQ = { alert: [880, 1175, 880], ok: [659, 988], tap: [523], warn: [440, 349] } as const;

export function playSound(kind: keyof typeof SEQ) {
  if (!useUi.getState().sound) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(kind === 'alert' ? 0.09 : 0.05, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'alert' ? 0.5 : 0.3));
    SEQ[kind].forEach((f, i) => {
      const o = ctx!.createOscillator();
      o.frequency.setValueAtTime(f, t + i * 0.08);
      o.connect(g);
      o.start(t + i * 0.08);
      o.stop(t + 0.55);
    });
  } catch {
    /* ses desteklenmiyor */
  }
}

/** İlk etkileşimde ses bağlamını uyandır. */
export function unlockSoundOnFirstInteraction() {
  const wake = () => {
    ctx ??= new AudioContext();
    void ctx.resume();
  };
  window.addEventListener('pointerdown', wake, { once: true });
}
