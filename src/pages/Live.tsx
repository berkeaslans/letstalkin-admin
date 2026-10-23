// Canlı: şu an hareketli odalar, canlı yayınlar, quizler ve uygulamada olan her
// şeyin anlık akışı (Socket.IO 'admin' kanalı).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/icon-names';
import { Card, EmptyState, ErrorState, LiveTag, Rows, Stat, Tag } from '@/components/ui/misc';
import { Pills } from '@/components/ui/Tabs';
import { type Activity, type ActivityKind, adminApi } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { fmt, timeAgo } from '@/lib/format';
import { go, paths } from '@/lib/go';
import { useLive } from '@/lib/realtime';
import { useIsAdmin } from '@/stores/session';
import { confirmAction, toast } from '@/stores/ui';

export const KIND: Record<ActivityKind, [string, IconName, string]> = {
  signup: ['Kayıt', 'person', 'text-up'],
  post: ['Gönderi', 'movie', 'text-text'],
  comment: ['Yorum', 'info', 'text-sub'],
  report: ['Şikayet', 'crisis_alert', 'text-live'],
  room: ['Oda', 'groups', 'text-blue'],
  quiz: ['Quiz', 'bolt', 'text-yellow'],
  live: ['Yayın', 'tv', 'text-live'],
  trade: ['Satış', 'toll', 'text-yellow'],
  verification: ['Mavi tik', 'verified', 'text-blue'],
  series_page: ['Dizi sayfası', 'theaters', 'text-yellow'],
  feedback: ['Geri bildirim', 'campaign', 'text-up'],
  deletion: ['Silme', 'remove_circle', 'text-live'],
  admin: ['Yönetim', 'admin_panel_settings', 'text-sub'],
};

/** Olayın gittiği yer (tıklanınca). */
function target(e: Activity): string | null {
  if (e.kind === 'room' && e.refId) return paths.room(e.refId);
  if (e.kind === 'quiz' && e.refId) return paths.quiz(e.refId);
  if (e.kind === 'report') return '/moderasyon';
  if (e.kind === 'feedback') return '/moderasyon/geri-bildirim';
  if (e.kind === 'verification') return '/kullanicilar/tikler';
  if (e.kind === 'series_page') return '/kullanicilar/sayfalar';
  if (e.kind === 'live') return '/canli';
  if (e.userId) return paths.user(e.userId);
  return null;
}

export function FeedRow({ e, fresh }: { e: Activity; fresh?: boolean }) {
  const [label, icon, tone] = KIND[e.kind];
  const to = target(e);
  return (
    <button
      type="button"
      disabled={!to}
      onClick={() => to && go(to)}
      className={cn(
        'flex w-full items-center gap-3 px-[18px] py-2.5 text-left shadow-[inset_0_0.5px_0_var(--color-line)] enabled:hover:bg-white/3',
        fresh && 'feed-in',
      )}
    >
      <span className={cn('grid h-8 w-8 flex-none place-items-center rounded-full bg-elev2', tone)}>
        <Icon name={icon} size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px]">{e.text}</span>
        <span className="text-[11.5px] text-faint">
          {label} · {timeAgo(e.at)}
        </span>
      </span>
      {to && <Icon name="chevron_right" size={16} className="text-faint" />}
    </button>
  );
}

const FILTERS: Array<{ key: ActivityKind | 'all'; label: string }> = [
  { key: 'all', label: 'Hepsi' },
  { key: 'signup', label: 'Kayıt' },
  { key: 'post', label: 'Gönderi' },
  { key: 'report', label: 'Şikayet' },
  { key: 'room', label: 'Oda' },
  { key: 'quiz', label: 'Quiz' },
  { key: 'trade', label: 'Satış' },
  { key: 'feedback', label: 'Geri bildirim' },
  { key: 'verification', label: 'Başvuru' },
];

export function LiveFeed() {
  const { events, status } = useLive();
  const [kind, setKind] = useState<ActivityKind | 'all'>('all');
  const rows = events.filter((e) => kind === 'all' || e.kind === kind || (kind === 'verification' && e.kind === 'series_page'));
  const minute = events.filter((e) => Date.now() - new Date(e.at).getTime() < 60_000).length;
  const hour = events.filter((e) => Date.now() - new Date(e.at).getTime() < 3_600_000).length;
  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <Card>
        <div className="flex flex-wrap items-center gap-2 px-[18px] py-3.5">
          <Pills items={FILTERS} value={kind} onChange={setKind} />
        </div>
        {!rows.length ? (
          <EmptyState
            icon="bolt"
            title="Henüz olay yok"
            body="Uygulamada biri kayıt olduğunda, paylaştığında ya da şikayet ettiğinde burada anında belirir."
          />
        ) : (
          rows.map((e, i) => <FeedRow key={`${e.at}${e.text}`} e={e} fresh={i < 3} />)
        )}
      </Card>
      <div className="flex flex-col gap-3.5 lg:sticky lg:top-[76px]">
        <Card>
          <div className="flex flex-col gap-3 px-[18px] py-4">
            <div className="flex items-center gap-2">
              {status === 'live' ? <LiveTag /> : <Tag>{status === 'connecting' ? 'Bağlanıyor' : 'Bağlantı yok'}</Tag>}
            </div>
            <p className="text-[13px] text-sub">
              {status === 'live'
                ? 'Olaylar sayfayı yenilemeden anında düşer. Şikayet ve başvurularda ses çalar.'
                : 'Bağlantı yeniden kurulana kadar ekranlar 15 saniyede bir yoklanır.'}
            </p>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-1">
          <Stat icon="bolt" label="Son 1 dakika" value={fmt(minute)} />
          <Stat icon="schedule" label="Son 1 saat" value={fmt(hour)} />
        </div>
      </div>
    </div>
  );
}

export function LiveNow() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'live'], queryFn: adminApi.live, refetchInterval: 10_000 });
  const events = useLive((s) => s.events);
  const end = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => adminApi.endStream(id, note),
    onSuccess: () => {
      toast('Yayın sonlandırıldı');
      qc.invalidateQueries({ queryKey: ['admin', 'live'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  if (q.isLoading)
    return (
      <Card>
        <Rows n={6} />
      </Card>
    );
  if (q.isError || !q.data)
    return (
      <Card>
        <ErrorState error={q.error} retry={() => q.refetch()} />
      </Card>
    );
  const d = q.data;
  return (
    <>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat icon="person" label="Şu an bağlı" value={fmt(d.online)} tone="live" />
        <Stat icon="groups" label="Hareketli oda" value={fmt(d.rooms.length)} sub="son 60 dakikada mesaj alan" />
        <Stat icon="info" label="Oda mesajı · 1 saat" value={fmt(d.messagesLastHour)} />
        <Stat
          icon="tv"
          label="Canlı yayın"
          value={fmt(d.streams.length)}
          sub={`${fmt(d.quizzes.filter((x) => x.status === 'live').length)} canlı quiz`}
        />
      </div>

      <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-3.5">
          <Card title="Hareketli odalar" sub="son 60 dakikadaki mesaja göre">
            {!d.rooms.length ? (
              <EmptyState icon="groups" title="Şu an sessiz" body="Son bir saatte mesaj alan oda yok." />
            ) : (
              d.rooms.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => go(paths.room(r.id))}
                  className="flex w-full items-center gap-3 px-[18px] py-3 text-left shadow-[inset_0_0.5px_0_var(--color-line)] hover:bg-white/3"
                >
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-[12px] bg-elev2">
                    <Icon name="groups" size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[14px] font-semibold">
                      <span className="truncate">{r.name}</span>
                      {r.kind !== 'permanent' && <Tag tone="yellow">{r.kind === 'official_finale' ? 'Final' : 'Geçici'}</Tag>}
                    </span>
                    <span className="block truncate text-[12.5px] text-sub">
                      {r.lastMessage
                        ? `${r.lastMessage.author ? `@${r.lastMessage.author.username}` : 'silinmiş hesap'}: ${r.lastMessage.text}`
                        : '—'}
                    </span>
                  </span>
                  <span className="flex flex-col items-end">
                    <b className="text-[15px] tabular">{fmt(r.recent)}</b>
                    <span className="text-[11px] text-faint">mesaj · {fmt(r.memberCount)} üye</span>
                  </span>
                </button>
              ))
            )}
          </Card>

          <div className="grid gap-3.5 lg:grid-cols-2">
            <Card title="Canlı yayınlar">
              {!d.streams.length ? (
                <EmptyState icon="tv" title="Yayın yok" />
              ) : (
                d.streams.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 px-[18px] py-3 shadow-[inset_0_0.5px_0_var(--color-line)]">
                    {s.streamer && <Avatar src={s.streamer.avatarPath} name={s.streamer.username} size={32} />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold">{s.title}</p>
                      <p className="text-[12px] text-faint">
                        @{s.streamer?.username} · {fmt(s.viewerCount)} izleyici · {timeAgo(s.startedAt)}
                      </p>
                    </div>
                    <Button
                      size="xs"
                      variant="danger"
                      onClick={async () => {
                        const c = await confirmAction({
                          title: 'Yayın sonlandırılsın mı?',
                          body: 'İzleyicilerin bağlantısı kesilir, yayıncıya bildirim gider.',
                          ok: 'Sonlandır',
                          danger: true,
                          note: 'optional',
                        });
                        if (c.ok) end.mutate({ id: s.id, note: c.note });
                      }}
                    >
                      Sonlandır
                    </Button>
                  </div>
                ))
              )}
            </Card>
            <Card title="Quizler" sub="canlı ve 24 saat içinde başlayacak">
              {!d.quizzes.length ? (
                <EmptyState icon="bolt" title="Quiz yok" />
              ) : (
                d.quizzes.map((x) => (
                  <button
                    type="button"
                    key={x.id}
                    disabled={!isAdmin}
                    onClick={() => go(paths.quiz(x.id))}
                    className="flex w-full items-center gap-3 px-[18px] py-3 text-left shadow-[inset_0_0.5px_0_var(--color-line)] enabled:hover:bg-white/3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold">{x.title}</p>
                      <p className="text-[12px] text-faint">
                        {x.status === 'live'
                          ? `soru ${x.currentQuestion + 1}/${x.questionCount}`
                          : x.startsAt
                            ? new Date(x.startsAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                            : 'elle başlatılacak'}{' '}
                        · {fmt(x.attemptCount)} katılımcı
                      </p>
                    </div>
                    {x.status === 'live' ? <LiveTag /> : <Tag tone="yellow">Planlı</Tag>}
                  </button>
                ))
              )}
            </Card>
          </div>
        </div>

        <Card
          title="Akış"
          sub="son olaylar"
          right={
            <Button size="xs" variant="ghost" onClick={() => go('/canli/akis')}>
              Tümü
            </Button>
          }
        >
          {events.length ? (
            events.slice(0, 14).map((e, i) => <FeedRow key={`${e.at}${e.text}`} e={e} fresh={i < 2} />)
          ) : (
            <EmptyState icon="bolt" title="Henüz olay yok" />
          )}
        </Card>
      </div>
    </>
  );
}
