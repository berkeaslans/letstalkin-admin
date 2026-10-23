import { NavLink } from 'react-router';
import { cn } from '@/lib/cn';

/** Bölüm alt sayfaları: alt çizgili sekmeler — aktif: beyaz metin + sarı çizgi (web Tabs). */
export function NavTabs({ items }: { items: Array<{ to: string; label: string; count?: number; soon?: boolean }> }) {
  return (
    <div role="tablist" className="no-scrollbar -mt-2 flex overflow-x-auto border-b-[0.5px] border-line">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end
          role="tab"
          className={({ isActive }) =>
            cn(
              'relative flex h-12 flex-none items-center gap-1.5 px-4 text-[14px] font-semibold tracking-[-0.1px] transition-colors',
              isActive ? 'text-text' : 'text-faint hover:text-sub',
            )
          }
        >
          {({ isActive }) => (
            <>
              {it.label}
              {!!it.count && <span className="text-[12px] font-bold text-live tabular">{it.count}</span>}
              {it.soon && <span className="text-[10.5px] font-semibold text-faint">yakında</span>}
              {isActive && <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-yellow" />}
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}

/** Hap segmentler (filtre çipleri): aktif = beyaz zemin siyah metin (web Pills). */
export function Pills<K extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: Array<{ key: K; label: string; count?: number }>;
  value: K;
  onChange: (k: K) => void;
  className?: string;
}) {
  return (
    <div className={cn('no-scrollbar flex gap-2 overflow-x-auto', className)} role="radiogroup">
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(it.key)}
            className={cn(
              'press flex h-8 flex-none items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors',
              active ? 'bg-text text-black' : 'bg-elev2 text-sub shadow-[inset_0_0_0_0.5px_var(--color-line2)] hover:text-text',
            )}
          >
            {it.label}
            {it.count !== undefined && (
              <span className={cn('text-[11.5px] tabular', active ? 'text-black/55' : 'text-faint')}>{it.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Seçmeli segment (tik, rol). */
export function Segment<K extends string>({
  items,
  value,
  onChange,
  disabled,
}: {
  items: Array<{ key: K; label: React.ReactNode; disabled?: boolean }>;
  value: K | null;
  onChange: (k: K) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1 rounded-[14px] bg-elev2 p-1 shadow-[inset_0_0_0_0.5px_var(--color-line2)]">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          disabled={disabled || it.disabled}
          onClick={() => onChange(it.key)}
          className={cn(
            'flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-[13px] font-semibold transition-colors disabled:opacity-40',
            value === it.key ? 'bg-elev3 text-text shadow-[inset_0_0_0_0.5px_var(--color-line2)]' : 'text-sub hover:text-text',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
