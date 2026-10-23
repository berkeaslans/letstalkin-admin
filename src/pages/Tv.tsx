import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { overviewQuery } from '@/components/layout/Shell';
import { Button, IconButton } from '@/components/ui/Button';
import { fmt } from '@/lib/format';

/** Son N ölçümün çizgisi (TV'de canlı akış hissi). */
function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="h-[46px]" />;
  const w = 220;
  const h = 46;
  const mx = Math.max(...values);
  const mn = Math.min(...values);
  const r = mx - mn || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 4 - ((v - mn) / r) * (h - 8)]);
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" className="block overflow-visible" aria-hidden="true">
      <path
        d={pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={3.5} fill={color} />
    </svg>
  );
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function Tv() {
  const nav = useNavigate();
  const now = useClock();
  const q = useQuery({ ...overviewQuery, refetchInterval: 10_000 });
  const hist = useRef<Record<string, number[]>>({});
  const o = q.data;
  if (o) {
    for (const k of ['online', 'activeToday', 'signupsToday', 'totalUsers'] as const) {
      hist.current[k] ??= [];
      const a = hist.current[k];
      if (a[a.length - 1] !== o[k] || a.length < 2) a.push(o[k]);
      if (a.length > 40) a.shift();
    }
  }
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && !document.fullscreenElement && nav('/');
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [nav]);

  const rows = [
    { k: 'online', label: 'Çevrimiçi', color: '#ff3b4e', note: 'son 2 dakika' },
    { k: 'activeToday', label: 'Bugün aktif', color: '#30d46b', note: 'İstanbul günü' },
    { k: 'signupsToday', label: 'Yeni kayıt', color: '#ffd800', note: 'bugün' },
    { k: 'totalUsers', label: 'Toplam', color: '#2069e8', note: 'kullanıcı' },
  ] as const;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black px-[max(32px,env(safe-area-inset-left))] pt-[max(22px,env(safe-area-inset-top))] pb-[max(18px,env(safe-area-inset-bottom))]">
      <div className="pointer-events-none absolute top-[6%] left-[18%] h-[min(620px,70vw)] w-[min(620px,70vw)] rounded-full bg-[radial-gradient(circle,rgb(255_216_0/0.09),transparent_62%)] [animation:breathe_7s_ease-in-out_infinite]" />
      <header className="relative flex items-center gap-4">
        <img src="/marka/dikey-koyu.svg" alt="Let's Talkin'" className="h-10 w-auto" />
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2.5 text-[14px] font-semibold text-sub tabular">
          <span className="h-2 w-2 rounded-full bg-up [animation:ok-dot_1.8s_var(--ease-out-cubic)_infinite]" />
          <b className="text-up">canlı</b>
          {now.toLocaleTimeString('tr-TR')}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})
            }
          >
            Tam ekran
          </Button>
          <IconButton icon="close" label="Panele dön (Esc)" onClick={() => nav('/')} />
        </div>
      </header>

      <div className="relative grid flex-1 items-center gap-[clamp(24px,5vw,72px)] py-7 lg:grid-cols-[minmax(0,1fr)_minmax(260px,330px)]">
        <div>
          {rows.map((r, i) => (
            <div
              key={r.k}
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 py-[18px] sm:grid-cols-[120px_minmax(0,1fr)_minmax(120px,220px)] ${i ? 'shadow-[inset_0_0.5px_0_var(--color-line2)]' : ''}`}
            >
              <span className="col-span-2 text-[15px] font-semibold text-sub sm:col-span-1">{r.label}</span>
              <span className="text-[clamp(44px,7vw,104px)] leading-none font-bold tracking-[-0.045em] whitespace-nowrap tabular">
                {o ? fmt(o[r.k]) : '—'}
              </span>
              <div className="hidden sm:block">
                <Spark values={hist.current[r.k] ?? []} color={r.color} />
                <p className="mt-1 text-right text-[12px] text-faint">{r.note}</p>
              </div>
            </div>
          ))}
        </div>
        <aside className="flex flex-col justify-center self-stretch pl-0 shadow-[inset_0_0.5px_0_var(--color-line2)] lg:pl-[clamp(20px,3vw,44px)] lg:shadow-[inset_0.5px_0_0_var(--color-line2)]">
          {[
            ['Açık şikayet', o?.openReports, o?.openReports ? 'text-live' : '', o?.openReports ? 'karar bekliyor' : 'kuyruk temiz'],
            ['Mavi tik başvurusu', o?.pendingVerifications, '', 'inceleme bekliyor'],
            ['Dizi sayfası başvurusu', o?.pendingSeriesPages, '', 'onay bekliyor'],
          ].map(([label, v, cls, sub], i) => (
            <div
              key={String(label)}
              className={`flex flex-col gap-0.5 py-[18px] ${i ? 'shadow-[inset_0_0.5px_0_var(--color-line2)]' : ''}`}
            >
              <span className="text-[13px] font-semibold text-sub">{label}</span>
              <span className={`text-[34px] leading-tight font-bold tracking-[-0.04em] tabular ${cls}`}>
                {v === undefined ? '—' : fmt(Number(v))}
              </span>
              <span className="text-[12px] text-faint">{sub}</span>
            </div>
          ))}
        </aside>
      </div>
      {q.isError && <p className="relative text-center text-[13px] text-live">Veri alınamıyor — bağlantı kontrol ediliyor</p>}
    </div>
  );
}
