import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Avatar, Tick } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { NavTabs } from '@/components/ui/Tabs';
import { adminApi, type Overview } from '@/lib/api/admin';
import { cn } from '@/lib/cn';
import { fmt } from '@/lib/format';
import { playSound } from '@/lib/sound';
import { useIsAdmin, useSession } from '@/stores/session';
import { toast, useUi } from '@/stores/ui';
import { findSub, navFor } from './nav';

/** Genel bakış verisi her yerde ortak: menü rozetleri, üst bardaki çevrimiçi sayısı, TV. */
export const overviewQuery = { queryKey: ['admin', 'overview'], queryFn: adminApi.overview, refetchInterval: 15_000 } as const;

/** Açık şikayet artınca: ses + bildirim (sayfa yenilemeden). */
function useNewReportAlert(o: Overview | undefined) {
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!o) return;
    if (last.current !== null && o.openReports > last.current) {
      const n = o.openReports - last.current;
      toast(n === 1 ? 'Yeni şikayet geldi' : `${n} yeni şikayet geldi`, 'alert', `Kuyrukta ${o.openReports} şikayet bekliyor`);
      playSound('alert');
    }
    last.current = o.openReports;
  }, [o]);
}

export function Shell() {
  const isAdmin = useIsAdmin();
  const me = useSession((s) => s.me);
  const logout = useSession((s) => s.logout);
  const { mini, setMini, sound, setSound } = useUi();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const ov = useQuery(overviewQuery);
  useNewReportAlert(ov.data);
  // biome-ignore lint/correctness/useExhaustiveDependencies: sayfa değişince mobil menü kapanır
  useEffect(() => setOpen(false), [pathname]);

  const nav = navFor(isAdmin);
  const here = findSub(pathname);
  const group = nav.find((g) => g.key === here?.group.key);
  const counts = ov.data;
  const groupCount = (keys?: Array<string | undefined>) =>
    (keys ?? []).reduce((a, k) => a + (k ? ((counts?.[k as keyof Overview] as number) ?? 0) : 0), 0);

  return (
    <div className={cn('grid min-h-dvh grid-cols-1', mini ? 'md:grid-cols-[76px_minmax(0,1fr)]' : 'md:grid-cols-[256px_minmax(0,1fr)]')}>
      {open && <div className="fixed inset-0 z-[70] bg-black/60 md:hidden" onClick={() => setOpen(false)} />}
      <nav
        aria-label="Yönetim menüsü"
        className={cn(
          'no-scrollbar fixed inset-y-0 left-0 z-[80] flex w-[272px] flex-col gap-0.5 overflow-y-auto border-r-[0.5px] border-line bg-black px-3.5 pt-[calc(22px+env(safe-area-inset-top))] pb-[calc(16px+env(safe-area-inset-bottom))] transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full',
          'md:sticky md:top-0 md:h-dvh md:w-auto md:translate-x-0',
          mini && 'md:px-3',
        )}
      >
        <Link to="/" className={cn('mb-5 flex items-end gap-2.5 px-2.5', mini && 'md:justify-center md:px-0')} aria-label="Genel bakış">
          <img
            src="/marka/dikey-koyu.svg"
            alt="Let's Talkin'"
            height={44}
            width={54}
            className={cn('block h-11 w-auto', mini && 'md:hidden')}
          />
          <img
            src="/marka/ikon-koyu.svg"
            alt="Let's Talkin'"
            width={36}
            height={36}
            className={cn('hidden h-9 w-9 rounded-full', mini && 'md:block')}
          />
          <span
            className={cn(
              'mb-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] text-yellow uppercase shadow-[inset_0_0_0_0.5px_rgb(255_216_0/0.4)]',
              mini && 'md:hidden',
            )}
          >
            Yönetim
          </span>
        </Link>

        {nav.map((g) => {
          const active = here?.group.key === g.key;
          const n = groupCount(g.count);
          const soon = g.subs.every((s) => s.soon);
          return (
            <NavLink
              key={g.key}
              to={g.subs[0].to}
              title={g.label}
              className={cn(
                'press relative flex h-11 items-center gap-3.5 rounded-[14px] px-3 text-[14.5px] tracking-[-0.2px] transition-colors',
                active ? 'font-semibold text-text' : 'font-medium text-sub hover:bg-white/5 hover:text-text',
                mini && 'md:justify-center md:gap-0 md:px-0',
              )}
            >
              <Icon name={g.icon} size={23} filled={active} />
              <span className={cn('min-w-0 flex-1 truncate', mini && 'md:hidden', soon && !active && 'text-faint')}>{g.label}</span>
              {g.live && !soon && <span className="live-dot h-2 w-2 rounded-full bg-live" />}
              {soon && <span className={cn('text-[10.5px] font-semibold text-faint', mini && 'md:hidden')}>yakında</span>}
              {n > 0 && (
                <span
                  className={cn(
                    'flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-live px-1.5 text-[10.5px] font-bold text-white tabular',
                    mini && 'md:absolute md:top-1.5 md:right-3 md:h-2.5 md:min-w-2.5 md:border-2 md:border-black md:p-0 md:text-[0px]',
                  )}
                >
                  {n > 99 ? '99+' : n}
                </span>
              )}
            </NavLink>
          );
        })}

        <div
          className={cn(
            'px-3 pt-4 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase',
            mini && 'md:px-0 md:text-center md:text-[0px]',
          )}
        >
          Ekranlar
        </div>
        <Link
          to="/tv"
          title="TV ekranı"
          className={cn(
            'press flex h-11 items-center gap-3.5 rounded-[14px] px-3 text-[14.5px] font-medium text-up hover:bg-white/5',
            mini && 'md:justify-center md:px-0',
          )}
        >
          <Icon name="tv" size={23} />
          <span className={cn('flex-1', mini && 'md:hidden')}>TV ekranı</span>
          <span className={cn('h-2 w-2 rounded-full bg-up shadow-[0_0_0_3px_rgb(48_212_107/0.18)]', mini && 'md:hidden')} />
        </Link>

        <div className="mt-auto flex flex-col gap-0.5 pt-5">
          <div className="mx-2.5 mb-2 h-[0.5px] bg-line" />
          {me && (
            <div
              className={cn('flex items-center gap-3 rounded-[14px] px-2.5 py-2', mini && 'md:justify-center md:px-0')}
              title={me.displayName ?? me.username}
            >
              <Avatar src={me.avatarPath} name={me.displayName ?? me.username} size={34} />
              <div className={cn('min-w-0 flex-1', mini && 'md:hidden')}>
                <p className="flex items-center gap-1.5 truncate text-[14px] font-semibold">
                  {me.displayName ?? me.username}
                  <Tick tick={me.tick} size={13} />
                </p>
                <p className="truncate text-[12px] text-sub">
                  {me.role === 'admin' ? 'Admin' : 'Moderatör'} · @{me.username}
                </p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={logout}
            title="Çıkış yap"
            className={cn(
              'press flex h-11 items-center gap-3.5 rounded-[14px] px-3 text-[14.5px] font-medium text-sub hover:bg-white/5 hover:text-text',
              mini && 'md:justify-center md:px-0',
            )}
          >
            <Icon name="logout" size={23} />
            <span className={cn(mini && 'md:hidden')}>Çıkış yap</span>
          </button>
          <button
            type="button"
            onClick={() => setMini(!mini)}
            title={mini ? 'Genişlet' : 'Daralt'}
            className={cn(
              'press hidden h-11 items-center gap-3.5 rounded-[14px] px-3 text-[14.5px] font-medium text-sub hover:bg-white/5 hover:text-text md:flex',
              mini && 'md:justify-center md:px-0',
            )}
          >
            <Icon name="chevron_left" size={23} className={cn('transition-transform', mini && 'rotate-180')} />
            <span className={cn(mini && 'md:hidden')}>Daralt</span>
          </button>
        </div>
      </nav>

      <main className="min-w-0">
        <header className="glass-nav sticky top-0 z-30 flex h-[58px] items-center gap-2 border-b-[0.5px] border-line pr-[max(12px,env(safe-area-inset-right))] pl-[max(8px,env(safe-area-inset-left))] md:pl-4">
          <IconButton icon="grid_view" label="Menü" className="md:hidden" onClick={() => setOpen(true)} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-bold tracking-[-0.3px]">{here?.group.label ?? 'Yönetim'}</h1>
            {here && <p className="truncate text-[12px] text-sub">{here.sub.desc}</p>}
          </div>
          {counts && (
            <span
              className="flex h-[34px] items-center gap-2 rounded-full bg-live/10 px-3 text-[12.5px] font-semibold whitespace-nowrap"
              title="Son 2 dakikada etkin"
            >
              <span className="live-dot h-[7px] w-[7px] rounded-full bg-live" />
              <b className="tabular">{fmt(counts.online)}</b>
              <span className="hidden sm:inline">çevrimiçi</span>
            </span>
          )}
          <IconButton icon="tv" label="TV ekranı" onClick={() => navigate('/tv')} />
          <IconButton
            icon={sound ? 'volume_up' : 'volume_off'}
            label={sound ? 'Sesli bildirimi kapat' : 'Sesli bildirimi aç'}
            onClick={() => {
              setSound(!sound);
              if (!sound) setTimeout(() => playSound('ok'));
            }}
          />
        </header>
        <div
          key={pathname}
          className="page-in flex w-full max-w-[1280px] flex-col gap-[18px] px-[max(16px,env(safe-area-inset-left))] pt-[22px] pb-16 md:px-6"
        >
          {group && group.subs.length > 1 && (
            <NavTabs
              items={group.subs.map((s) => ({
                to: s.to,
                label: s.label,
                soon: s.soon,
                count: s.count ? (counts?.[s.count] ?? 0) : undefined,
              }))}
            />
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
