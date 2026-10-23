import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { overviewQuery } from '@/components/layout/Shell';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/icon-names';
import { Card, EmptyState, ErrorState, LiveTag, Rows, Stat } from '@/components/ui/misc';
import { adminApi } from '@/lib/api/admin';
import { fmt, greeting } from '@/lib/format';
import { useIsAdmin, useSession } from '@/stores/session';
import { AuditList } from './Audit';

export function Overview() {
  const me = useSession((s) => s.me);
  const isAdmin = useIsAdmin();
  const nav = useNavigate();
  const q = useQuery(overviewQuery);
  const audit = useQuery({
    queryKey: ['admin', 'audit', 'recent'],
    queryFn: () => adminApi.audit({}),
    enabled: isAdmin,
    refetchInterval: 30_000,
  });
  const o = q.data;

  const todo: Array<{ icon: IconName; color: string; title: string; body: string; to: string }> = [];
  if (o?.openReports)
    todo.push({
      icon: 'crisis_alert',
      color: 'var(--color-live)',
      title: `${fmt(o.openReports)} şikayet karar bekliyor`,
      body: 'Moderasyon kuyruğu',
      to: '/moderasyon',
    });
  if (isAdmin && o?.pendingVerifications)
    todo.push({
      icon: 'verified',
      color: '#6aa0ff',
      title: `${fmt(o.pendingVerifications)} mavi tik başvurusu`,
      body: 'Kimlik belgesi incelemesi',
      to: '/kullanicilar/tikler',
    });
  if (isAdmin && o?.pendingSeriesPages)
    todo.push({
      icon: 'movie',
      color: 'var(--color-yellow)',
      title: `${fmt(o.pendingSeriesPages)} dizi sayfası başvurusu`,
      body: 'Fan ve resmi sayfa',
      to: '/kullanicilar/sayfalar',
    });

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-sub">
            {greeting()}, {me?.displayName?.split(' ')[0] ?? me?.username}
          </span>
          <h2 className="flex flex-wrap items-center gap-2.5 text-[24px] font-bold tracking-[-0.5px]">
            Let's Talkin'de neler oluyor <LiveTag />
          </h2>
        </div>
      </div>

      {q.isError ? (
        <Card>
          <ErrorState error={q.error} retry={() => q.refetch()} />
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
          <Stat label="Çevrimiçi" icon="bolt" value={o ? fmt(o.online) : '—'} sub="son 2 dakika" />
          <Stat label="Bugün aktif" icon="group" value={o ? fmt(o.activeToday) : '—'} sub="İstanbul saatiyle" />
          <Stat
            label="Yeni kayıt"
            icon="person"
            value={o ? fmt(o.signupsToday) : '—'}
            sub="bugün"
            tone="up"
            onClick={() => nav('/kullanicilar')}
          />
          <Stat label="Toplam kullanıcı" icon="groups" value={o ? fmt(o.totalUsers) : '—'} sub="silinenler hariç" />
        </div>
      )}

      <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card title="Gündem" sub={o ? (todo.length ? `${todo.length} iş bekliyor` : 'her şey yolunda') : undefined}>
          {!o ? (
            <Rows n={3} />
          ) : todo.length ? (
            todo.map((t) => (
              <div key={t.to} className="flex items-center gap-3.5 px-[18px] py-3.5 shadow-[inset_0_0.5px_0_var(--color-line)]">
                <span
                  className="grid h-[42px] w-[42px] flex-none place-items-center rounded-[14px]"
                  style={{ background: `color-mix(in srgb, ${t.color} 14%, transparent)`, color: t.color }}
                >
                  <Icon name={t.icon} size={22} filled />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold">{t.title}</p>
                  <p className="text-[12.5px] text-sub">{t.body}</p>
                </div>
                <Button size="sm" onClick={() => nav(t.to)}>
                  İncele
                </Button>
              </div>
            ))
          ) : (
            <EmptyState title="Bekleyen iş yok" body="Şikayet, başvuru ve onay kuyrukları boş." />
          )}
        </Card>
        {isAdmin && (
          <Card
            title="Son yönetici işlemleri"
            right={
              <Button size="xs" variant="outline" onClick={() => nav('/sistem/denetim')}>
                Tümü
              </Button>
            }
          >
            {audit.isLoading ? (
              <Rows n={4} />
            ) : audit.isError ? (
              <ErrorState error={audit.error} />
            ) : (
              <AuditList items={audit.data?.items.slice(0, 6) ?? []} compact />
            )}
          </Card>
        )}
      </div>
    </>
  );
}
