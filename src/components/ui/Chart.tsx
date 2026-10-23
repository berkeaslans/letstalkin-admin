// Grafikler: tek seri günlük çubuk (zaman serisi) ve yatay çubuk listesi.
// Tek seri → lejant yok, başlık adlandırır. İnce çubuk, 4px yuvarlak uç, 2px
// boşluk; eksen ve kılavuz çizgisi geri planda; her çubukta üzerine gelince ipucu.
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { compact, fmt } from '@/lib/format';

export function DailyBars({
  data,
  height = 140,
  label,
  className,
}: {
  data: Array<{ day: string; value: number }>;
  height?: number;
  /** İpucunda değerin yanına yazılır ("kayıt", "mesaj"...). */
  label: string;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((n, d) => n + d.value, 0);
  const h = hover !== null ? data[hover] : null;
  const dayLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline gap-2 text-[12px] text-sub">
        {h ? (
          <>
            <b className="text-[15px] text-text tabular">{fmt(h.value)}</b> {label} · {dayLabel(h.day)}
          </>
        ) : (
          <>
            <b className="text-[15px] text-text tabular">{fmt(total)}</b> {label} · {data.length} gün
          </>
        )}
      </div>
      <div className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-white/6" />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-white/6" />
        <span className="pointer-events-none absolute -top-0.5 right-0 text-[10.5px] text-faint tabular">{compact(max)}</span>
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {data.map((d, i) => (
            <button
              type="button"
              key={d.day}
              aria-label={`${dayLabel(d.day)}: ${fmt(d.value)} ${label}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              className="group flex h-full min-w-0 flex-1 items-end"
            >
              <span
                className={cn(
                  'block w-full rounded-t-[4px] transition-colors',
                  hover === i ? 'bg-yellow' : 'bg-yellow/55 group-hover:bg-yellow',
                )}
                style={{ height: `${Math.max(d.value ? 3 : 1, (d.value / max) * 100)}%`, opacity: d.value ? 1 : 0.35 }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-between text-[10.5px] text-faint">
        <span>{data[0] && dayLabel(data[0].day)}</span>
        <span>{data.at(-1) && dayLabel(data.at(-1)!.day)}</span>
      </div>
    </div>
  );
}

/** Yatay çubuk listesi: büyüklük karşılaştırması (adlar solda, değer sağda). */
export function HBars({
  rows,
  format = fmt,
  max: maxIn,
}: {
  rows: Array<{ key: string; label: string; value: number; hint?: string }>;
  format?: (n: number) => string;
  max?: number;
}) {
  const max = maxIn ?? Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.key} className="flex flex-col gap-1" title={r.hint}>
          <div className="flex items-baseline gap-2 text-[13px]">
            <span className="min-w-0 flex-1 truncate">{r.label}</span>
            {r.hint && <span className="text-[11.5px] text-faint">{r.hint}</span>}
            <b className="tabular">{format(r.value)}</b>
          </div>
          <div className="h-[6px] overflow-hidden rounded-full bg-white/6">
            <div className="h-full rounded-full bg-yellow/80" style={{ width: `${(Math.abs(r.value) / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Önceki döneme göre değişim (% ve yön). */
export function Delta({ now, prev }: { now: number; prev: number }) {
  if (!prev) return now ? <span className="text-[11.5px] font-semibold text-up">yeni</span> : null;
  const p = Math.round(((now - prev) / prev) * 100);
  if (p === 0) return <span className="text-[11.5px] text-faint">±0%</span>;
  return <span className={cn('text-[11.5px] font-semibold tabular', p > 0 ? 'text-up' : 'text-live')}>{p > 0 ? `↑${p}%` : `↓${-p}%`}</span>;
}
