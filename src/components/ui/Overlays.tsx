import { type ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { useUi } from '@/stores/ui';
import { Button, IconButton } from './Button';
import { Icon } from './Icon';

/** Alt ortada kısa bildirim (web Toaster ile aynı yüzey). */
export function Toaster() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(20px+env(safe-area-inset-bottom))] z-[120] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto flex max-w-[420px] items-center gap-2.5 rounded-card bg-elev2 py-3 pr-4 pl-3.5 text-[13.5px] font-medium shadow-[inset_0_0_0_0.5px_var(--color-line),0_12px_40px_rgb(0_0_0/0.55)] [animation:pop-in_.34s_var(--ease-spring)]"
        >
          {t.kind === 'success' && <Icon name="check_circle" size={19} filled className="text-yellow" />}
          {t.kind === 'error' && <Icon name="error" size={19} filled className="text-live" />}
          {t.kind === 'alert' && <Icon name="crisis_alert" size={19} filled className="text-live" />}
          {t.kind === 'info' && <Icon name="info" size={19} className="text-sub" />}
          <span>
            {t.text}
            {t.sub && <span className="block text-[12px] font-normal text-sub">{t.sub}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Onay penceresi; gerekçe isteyebilir (denetim kaydına yazılır). */
export function ConfirmDialog() {
  const req = useUi((s) => s.confirm);
  const [note, setNote] = useState('');
  // biome-ignore lint/correctness/useExhaustiveDependencies: her yeni onayda gerekçe alanı boş başlar
  useEffect(() => setNote(''), [req]);
  if (!req) return null;
  const close = (ok: boolean) => {
    req.resolve({ ok, note: note.trim() });
    useUi.setState({ confirm: null });
  };
  const blocked = req.note === 'required' && note.trim().length < 3;
  return (
    <>
      <div className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-[4px] [animation:fade-in_.2s]" onClick={() => close(false)} />
      <div
        role="alertdialog"
        aria-modal="true"
        className="fixed top-1/2 left-1/2 z-[96] flex w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3.5 rounded-feature bg-elev2 p-[22px] shadow-[inset_0_0_0_0.5px_var(--color-line2),0_30px_80px_rgb(0_0_0/0.6)]"
        onKeyDown={(e) => e.key === 'Escape' && close(false)}
      >
        <h3 className="text-[18px] font-bold tracking-[-0.3px]">{req.title}</h3>
        <p className="text-[13.5px] text-sub">{req.body}</p>
        {req.note && (
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder={
              req.note === 'required' ? 'Gerekçe (zorunlu, denetim kaydına yazılır)' : 'Gerekçe (isteğe bağlı, denetim kaydına yazılır)'
            }
            className="h-11 w-full rounded-option bg-elev px-3.5 text-[14px] outline-none shadow-[inset_0_0_0_0.5px_var(--color-line2)] focus:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.32)]"
          />
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button variant={req.danger ? 'danger' : 'primary'} disabled={blocked} onClick={() => close(true)} autoFocus={!req.note}>
            {req.ok}
          </Button>
        </div>
      </div>
    </>
  );
}

/** Sağdan açılan çekmece. */
export function Drawer({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && !useUi.getState().confirm && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-[4px] [animation:fade-in_.2s]" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          'fixed inset-y-0 right-0 z-[91] flex w-[min(520px,100%)] flex-col bg-elev pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
          'shadow-[inset_0.5px_0_0_var(--color-line2),-30px_0_80px_rgb(0_0_0/0.5)] [animation:drawer-in_.32s_var(--ease-out-cubic)]',
        )}
      >
        <div className="flex h-[58px] flex-none items-center gap-1.5 pr-2.5 pl-[18px]">
          <h2 className="min-w-0 flex-1 truncate text-[17px] font-bold tracking-[-0.3px]">{title}</h2>
          <IconButton icon="close" label="Kapat" onClick={onClose} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto [&>*]:flex-none">{children}</div>
        {footer && (
          <div className="flex flex-none items-center gap-2 px-[18px] py-3 shadow-[inset_0_0.5px_0_var(--color-line)]">{footer}</div>
        )}
      </aside>
    </>
  );
}
