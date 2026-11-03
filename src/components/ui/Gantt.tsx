// Zaman çizelgesi (Gantt): solda satır adları, sağda günler. Görev ve hedef çubuk, takvim olayı
// nokta olarak çizilir. Hafta sonları hafif koyu, bugün sarı dikey çizgi. Dar ekranda yatay kayar,
// satır adları solda sabit kalır.
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';
import type { IconName } from './icon-names';

export type GanttTone = 'todo' | 'doing' | 'done' | 'dropped' | 'late' | 'goal' | 'goal-done';

export interface GanttItem {
  id: string;
  label: string;
  /** YYYY-MM-DD, ikisi de dahil. */
  start: string;
  end: string;
  tone: GanttTone;
  /** Nokta (tek günlük olay) — çubuk yerine ikon. */
  point?: { icon: IconName; cls: string };
  /** Hedef çubuğunda dolu kısım (0–1). */
  progress?: number;
  /** Satır adının altında küçük yazı: kişi, durum. */
  meta?: ReactNode;
  /** Çubuğun içinde sağda (ör. 12 / 50). */
  value?: string;
  onClick?: () => void;
}
export interface GanttGroup {
  key: string;
  label: string;
  items: GanttItem[];
}

const TONE: Record<GanttTone, string> = {
  todo: 'bg-elev3 text-text shadow-[inset_0_0_0_0.5px_var(--color-line2)]',
  doing: 'bg-yellow text-black',
  done: 'bg-up/20 text-up',
  dropped: 'bg-white/5 text-faint line-through',
  late: 'bg-live/15 text-live shadow-[inset_0_0_0_1px_rgb(255_59_78/0.5)]',
  goal: 'bg-yellow/10 text-yellow shadow-[inset_0_0_0_0.5px_rgb(255_216_0/0.35)]',
  'goal-done': 'bg-up/15 text-up',
};

const idx = (days: string[], d: string) => {
  if (d < days[0]) return -1;
  if (d > days.at(-1)!) return days.length;
  return days.indexOf(d);
};
const weekday = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();

export function Gantt({
  days,
  today,
  groups,
  dayWidth = 34,
  metric,
  empty,
}: {
  days: string[];
  today: string;
  groups: GanttGroup[];
  dayWidth?: number;
  /** Başlığın altında her gün için küçük sayı (ör. o günkü toplam kullanıcı). */
  metric?: { label: string; value: (day: string) => string | null };
  empty?: ReactNode;
}) {
  const LABEL = 'w-[150px] sm:w-[230px]';
  const width = days.length * dayWidth;
  const todayI = days.indexOf(today);
  const rows = groups.filter((g) => g.items.length);

  // Arka plan: hafta sonu sütunları ve bugün çizgisi bütün satırların altında.
  const backdrop = (
    <div className="pointer-events-none absolute inset-y-0 left-0" style={{ width }}>
      {days.map((d, i) =>
        weekday(d) === 0 || weekday(d) === 6 ? (
          <span key={d} className="absolute inset-y-0 bg-white/[0.025]" style={{ left: i * dayWidth, width: dayWidth }} />
        ) : null,
      )}
      {todayI >= 0 && <span className="absolute inset-y-0 w-[2px] bg-yellow/70" style={{ left: todayI * dayWidth + dayWidth / 2 - 1 }} />}
    </div>
  );

  return (
    <div className="no-scrollbar overflow-x-auto">
      <div className="min-w-max">
        {/* Gün başlığı */}
        <div className="flex border-b-[0.5px] border-line">
          <div className={cn(LABEL, 'sticky left-0 z-20 flex-none bg-elev')} />
          <div className="relative flex" style={{ width }}>
            {days.map((d) => {
              const isToday = d === today;
              const we = weekday(d) === 0 || weekday(d) === 6;
              return (
                <div key={d} className="flex flex-none flex-col items-center py-1.5" style={{ width: dayWidth }}>
                  <span className={cn('text-[10px] font-medium', we ? 'text-faint' : 'text-sub')}>
                    {['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'][weekday(d)]}
                  </span>
                  <span
                    className={cn(
                      'mt-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full text-[12px] font-semibold tabular',
                      isToday ? 'bg-yellow text-black' : we ? 'text-faint' : 'text-text',
                    )}
                  >
                    {Number(d.slice(8))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        {metric && (
          <div className="flex border-b-[0.5px] border-line">
            <div className={cn(LABEL, 'sticky left-0 z-20 flex-none bg-elev px-[18px] py-1.5 text-[11.5px] text-faint')}>
              {metric.label}
            </div>
            <div className="relative flex" style={{ width }}>
              {days.map((d) => (
                <span key={d} className="flex-none py-1.5 text-center text-[10.5px] text-sub tabular" style={{ width: dayWidth }}>
                  {metric.value(d) ?? ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {rows.length === 0 && empty}
        {rows.map((g) => (
          <div key={g.key}>
            <div className="flex bg-white/[0.02]">
              <div className={cn(LABEL, 'sticky left-0 z-20 flex-none bg-elev2 px-[18px] py-2 text-[12px] font-bold')}>{g.label}</div>
              <div className="bg-elev2" style={{ width }} />
            </div>
            <div>
              {g.items.map((it) => {
                const s = Math.max(0, idx(days, it.start));
                const e = Math.min(days.length - 1, idx(days, it.end));
                const visible = idx(days, it.end) >= 0 && idx(days, it.start) < days.length;
                const cutL = idx(days, it.start) < 0;
                const cutR = idx(days, it.end) >= days.length;
                const left = s * dayWidth + 2;
                const w = Math.max(dayWidth - 4, (e - s + 1) * dayWidth - 4);
                return (
                  <div key={it.id} className="flex h-[38px] border-b-[0.5px] border-line/60">
                    <button
                      type="button"
                      onClick={it.onClick}
                      className={cn(
                        LABEL,
                        'press sticky left-0 z-20 flex flex-none flex-col justify-center bg-elev px-[18px] text-left hover:bg-elev2',
                      )}
                    >
                      <span className="truncate text-[12.5px] font-medium">{it.label}</span>
                      {it.meta && <span className="truncate text-[10.5px] text-faint">{it.meta}</span>}
                    </button>
                    <div className="relative flex-none" style={{ width }}>
                      {backdrop}
                      {visible &&
                        (it.point ? (
                          <button
                            type="button"
                            onClick={it.onClick}
                            title={it.label}
                            className="press absolute top-1/2 flex -translate-y-1/2 items-center gap-1 whitespace-nowrap"
                            style={{ left: s * dayWidth + dayWidth / 2 - 9 }}
                          >
                            <Icon name={it.point.icon} size={18} filled className={it.point.cls} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={it.onClick}
                            title={it.label}
                            className={cn(
                              'press absolute top-[7px] flex h-[24px] items-center gap-1.5 overflow-hidden rounded-[7px] px-2 text-[11.5px] font-semibold',
                              TONE[it.tone],
                              cutL && 'rounded-l-none',
                              cutR && 'rounded-r-none',
                            )}
                            style={{ left, width: w }}
                          >
                            {it.progress !== undefined && (
                              <span
                                className={cn('absolute inset-y-0 left-0', it.tone === 'goal-done' ? 'bg-up/25' : 'bg-yellow/35')}
                                style={{ width: `${Math.min(1, it.progress) * 100}%` }}
                              />
                            )}
                            {it.value && <span className="relative ml-auto flex-none tabular">{it.value}</span>}
                          </button>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Ay gezinme: ‹ Kasım 2026 › Bugün. */
export function MonthNav({ month, current, onChange }: { month: string; current: string; onChange: (m: string | undefined) => void }) {
  const shift = (by: number) => {
    const [y, m] = month.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
  };
  const label = new Date(`${month}-15T12:00:00`).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Önceki ay"
        onClick={() => onChange(shift(-1))}
        className="press flex h-9 w-9 items-center justify-center rounded-full hover:bg-elev2"
      >
        <Icon name="chevron_left" size={22} />
      </button>
      <span className="min-w-[124px] text-center text-[15px] font-bold capitalize">{label}</span>
      <button
        type="button"
        aria-label="Sonraki ay"
        onClick={() => onChange(shift(1))}
        className="press flex h-9 w-9 items-center justify-center rounded-full hover:bg-elev2"
      >
        <Icon name="chevron_right" size={22} />
      </button>
      {month !== current && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="press ml-1 h-8 rounded-full bg-elev2 px-3 text-[12.5px] font-semibold shadow-[inset_0_0_0_0.5px_var(--color-line2)]"
        >
          Bugün
        </button>
      )}
    </div>
  );
}

/** Ayın günleri (YYYY-MM-DD). */
export function monthDays(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}
