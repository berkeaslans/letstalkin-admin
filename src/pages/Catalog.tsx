// Katalog: uygulamada konuşulan yapımlar + her yapımın topluluk karnesi (ayrı
// sayfa) ve ana sayfa vitrini (sıralı liste; uygulama/web /featured ile okur).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Avatar, Tick } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { HBars } from '@/components/ui/Chart';
import { Icon } from '@/components/ui/Icon';
import { Card, EmptyState, ErrorState, Rows, Stat, Tag } from '@/components/ui/misc';
import { Pills } from '@/components/ui/Tabs';
import { adminApi, type Featured, type ShowRow, type ShowSort } from '@/lib/api/admin';
import { ApiError, errorMessage } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { compact, fmt, timeAgo } from '@/lib/format';
import { go, paths } from '@/lib/go';
import { playSound } from '@/lib/sound';
import { useIsAdmin } from '@/stores/session';
import { toast } from '@/stores/ui';
import { field } from './Publish';

const poster = (p: string | null | undefined, w = 185) => (p ? (p.startsWith('http') ? p : `https://image.tmdb.org/t/p/w${w}${p}`) : null);
const WATCH: Record<string, string> = {
  watching: 'İzliyor',
  completed: 'Bitirdi',
  plan: 'İzleyecek',
  planned: 'İzleyecek',
  dropped: 'Bıraktı',
  paused: 'Ara verdi',
};
const TYPE: Record<string, string> = { post: 'Gönderi', review: 'İnceleme', poll: 'Anket', quote: 'Alıntı', clip: 'Klip' };

function Poster({ path, className }: { path: string | null; className?: string }) {
  const url = poster(path);
  return (
    <span className={cn('grid flex-none place-items-center overflow-hidden rounded-[10px] bg-elev3', className)}>
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <Icon name="movie" size={20} className="text-faint" />
      )}
    </span>
  );
}

export function Shows() {
  const [sort, setSort] = useState<ShowSort>('discussion');
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      setTerm(q.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const r = useQuery({
    queryKey: ['admin', 'shows', sort, term, page],
    queryFn: () => adminApi.shows({ sort, q: term || undefined, page }),
    placeholderData: (p) => p,
  });
  const rows = r.data?.items ?? [];
  const pages = Math.ceil((r.data?.total ?? 0) / 40);
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 px-[18px] py-3.5">
        <Pills
          items={[
            { key: 'discussion', label: 'En çok konuşulan' },
            { key: 'followers', label: 'En çok takip' },
            { key: 'upcoming', label: 'Yeni bölüm yakında' },
            { key: 'recent', label: 'Son eklenen' },
          ]}
          value={sort}
          onChange={(s) => {
            setSort(s);
            setPage(0);
          }}
        />
        <input
          className={cn(field, 'ml-auto max-w-[280px]')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Yapım adı ya da TMDB ID"
        />
      </div>
      {r.isLoading ? (
        <Rows />
      ) : r.isError ? (
        <ErrorState error={r.error} retry={() => r.refetch()} />
      ) : !rows.length ? (
        <EmptyState icon="theaters" title="Yapım yok" body="Kullanıcılar bir dizi hakkında paylaştıkça, oda açtıkça burada belirir." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="text-left text-[12px] text-faint">
                <th className="px-[18px] py-2 font-semibold">Yapım</th>
                <th className="px-3 py-2 text-right font-semibold">Gönderi</th>
                <th className="px-3 py-2 text-right font-semibold">Oda</th>
                <th className="px-3 py-2 text-right font-semibold">İzleme listesi</th>
                <th className="px-3 py-2 text-right font-semibold">Takipçi</th>
                <th className="px-[18px] py-2 font-semibold">Sonraki bölüm</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s: ShowRow) => (
                <tr
                  key={s.tmdbId}
                  onClick={() => go(paths.show(s.tmdbId))}
                  className="cursor-pointer shadow-[inset_0_0.5px_0_var(--color-line)] hover:bg-white/3"
                >
                  <td className="px-[18px] py-2">
                    <span className="flex items-center gap-3">
                      <Poster path={s.posterPath} className="h-12 w-8 rounded-[6px]" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{s.name}</span>
                        <span className="text-[11.5px] text-faint">TMDB {s.tmdbId}</span>
                      </span>
                      {s.isFinale && <Tag tone="live">Final</Tag>}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular">{fmt(s.posts)}</td>
                  <td className="px-3 py-2 text-right tabular">{fmt(s.rooms)}</td>
                  <td className="px-3 py-2 text-right tabular">{fmt(s.watchers)}</td>
                  <td className="px-3 py-2 text-right tabular">{compact(s.followerCount)}</td>
                  <td className="px-[18px] py-2 whitespace-nowrap text-sub">
                    {s.nextAirDate ? new Date(s.nextAirDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 p-4 text-[13px] text-sub">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Önceki
          </Button>
          {page + 1} / {pages}
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
            Sonraki
          </Button>
        </div>
      )}
    </Card>
  );
}

export function ShowPage() {
  const { tmdbId } = useParams<{ tmdbId: string }>();
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'shows', 'detail', tmdbId], queryFn: () => adminApi.show(tmdbId!), enabled: !!tmdbId });
  const feat = useQuery({ queryKey: ['admin', 'featured'], queryFn: adminApi.featured, enabled: isAdmin });
  const done = (msg: string) => ({
    onSuccess: () => {
      toast(msg);
      playSound('ok');
      qc.invalidateQueries({ queryKey: ['admin', 'shows'] });
      qc.invalidateQueries({ queryKey: ['admin', 'featured'] });
    },
    onError: (e: unknown) => toast(errorMessage(e), 'error'),
  });
  const refresh = useMutation({ mutationFn: () => adminApi.refreshShow(tmdbId!), ...done('TMDB bilgisi tazelendi') });
  const toggle = useMutation({
    mutationFn: (on: boolean) => {
      const cur = feat.data ?? [];
      const s = q.data!;
      return adminApi.setFeatured(
        on ? [...cur, { tmdbId: s.tmdbId, kind: 'tv', title: s.name, posterPath: s.posterPath }] : cur.filter((f) => f.tmdbId !== s.tmdbId),
      );
    },
    ...done('Vitrin güncellendi'),
  });
  if (!q.data) return <Card>{q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : <Rows n={8} />}</Card>;
  const s = q.data;
  const bg = poster(s.backdropPath, 780);
  return (
    <div className="flex flex-col gap-3.5">
      <Card className="overflow-hidden">
        <div className="relative">
          {bg && <img src={bg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />}
          <div className="relative flex flex-wrap items-end gap-4 bg-gradient-to-t from-elev via-elev/70 to-transparent px-[18px] pt-10 pb-5">
            <Poster path={s.posterPath} className="h-[132px] w-[88px] rounded-[12px] shadow-[0_10px_30px_rgb(0_0_0/0.5)]" />
            <div className="min-w-0 flex-1">
              <h2 className="text-[24px] font-bold tracking-[-0.5px]">{s.name}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Tag>TMDB {s.tmdbId}</Tag>
                {s.featured && <Tag tone="yellow">Vitrinde</Tag>}
                {s.isFinale && <Tag tone="live">Final</Tag>}
                {s.nextAirDate && (
                  <Tag>Sonraki bölüm {new Date(s.nextAirDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</Tag>
                )}
                <span className="text-[12px] text-faint">bilgi {timeAgo(s.updatedAt)} güncellendi</span>
              </div>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" icon="refresh" busy={refresh.isPending} onClick={() => refresh.mutate()}>
                  TMDB'den tazele
                </Button>
                <Button
                  size="sm"
                  variant={s.featured ? 'secondary' : 'primary'}
                  busy={toggle.isPending}
                  disabled={!feat.data}
                  onClick={() => toggle.mutate(!s.featured)}
                >
                  {s.featured ? 'Vitrinden çıkar' : 'Vitrine ekle'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-5">
        <Stat icon="movie" label="Gönderi" value={fmt(s.posts)} />
        <Stat
          icon="workspace_premium"
          label="İnceleme puanı"
          value={s.reviews.avg != null ? s.reviews.avg.toFixed(1) : '—'}
          sub={`${fmt(s.reviews.count)} inceleme`}
        />
        <Stat icon="groups" label="Oda" value={fmt(s.rooms)} />
        <Stat icon="bolt" label="Quiz · sticker" value={`${fmt(s.quizzes)} · ${fmt(s.stickers)}`} />
        <Stat icon="visibility" label="İzleme listesinde" value={fmt(s.watchers)} />
      </div>
      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card title="Son gönderiler">
          {!s.recentPosts.length ? (
            <EmptyState icon="movie" title="Henüz gönderi yok" body="Bu yapım hakkında kimse paylaşım yapmamış." />
          ) : (
            s.recentPosts.map((p) => (
              <div key={p.id} className="flex flex-col gap-1 px-[18px] py-3 shadow-[inset_0_0.5px_0_var(--color-line)]">
                <div className="flex items-center gap-2 text-[12.5px]">
                  {p.author && (
                    <button
                      type="button"
                      onClick={() => go(paths.user(p.author!.id))}
                      className="flex items-center gap-1.5 hover:text-text"
                    >
                      <Avatar src={p.author.avatarPath} name={p.author.username} size={20} />
                      <b>@{p.author.username}</b>
                      <Tick tick={p.author.tick} size={11} />
                    </button>
                  )}
                  <Tag>{TYPE[p.type] ?? p.type}</Tag>
                  {p.rating != null && <Tag tone="yellow">{p.rating}/10</Tag>}
                  <span className="ml-auto text-faint">
                    {fmt(p.likeCount)} beğeni · {timeAgo(p.createdAt)}
                  </span>
                </div>
                <p className="line-clamp-3 text-[13.5px] break-words">{p.text || <span className="text-faint">metin yok</span>}</p>
              </div>
            ))
          )}
        </Card>
        <div className="flex flex-col gap-3.5">
          <Card title="İzleme durumu">
            <div className="px-[18px] pb-5">
              {s.watchStatus.length ? (
                <HBars rows={s.watchStatus.map((w) => ({ key: w.status, label: WATCH[w.status] ?? w.status, value: w.count }))} />
              ) : (
                <p className="text-[13px] text-faint">Kimse eklememiş</p>
              )}
            </div>
          </Card>
          <Card title="İçerik türleri">
            <div className="px-[18px] pb-5">
              {s.postTypes.length ? (
                <HBars rows={s.postTypes.map((t) => ({ key: t.type, label: TYPE[t.type] ?? t.type, value: t.count }))} />
              ) : (
                <p className="text-[13px] text-faint">—</p>
              )}
            </div>
          </Card>
          <Card title="Odalar">
            {!s.topRooms.length ? (
              <p className="px-[18px] pb-4 text-[13px] text-faint">Bu yapım için oda yok</p>
            ) : (
              s.topRooms.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => go(paths.room(r.id))}
                  className="flex w-full items-center gap-2 px-[18px] py-2.5 text-left text-[13px] shadow-[inset_0_0.5px_0_var(--color-line)] hover:bg-white/3"
                >
                  <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                  {r.status !== 'active' && <Tag>Arşiv</Tag>}
                  <span className="text-faint tabular">{fmt(r.memberCount)} üye</span>
                </button>
              ))
            )}
          </Card>
          <Card title="Dizi sayfaları">
            {!s.pages.length ? (
              <p className="px-[18px] pb-4 text-[13px] text-faint">Resmi ya da fan sayfası yok</p>
            ) : (
              s.pages.map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-[18px] py-2.5 text-[13px] shadow-[inset_0_0.5px_0_var(--color-line)]">
                  {p.user ? (
                    <button type="button" onClick={() => go(paths.user(p.user!.id))} className="font-semibold hover:text-text">
                      @{p.user.username}
                    </button>
                  ) : (
                    '—'
                  )}
                  <Tag tone={p.kind === 'official' ? 'yellow' : undefined}>{p.kind === 'official' ? 'Resmi' : 'Fan'}</Tag>
                  <span className="ml-auto text-faint">{p.status}</span>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export function Showcase() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'featured'], queryFn: adminApi.featured });
  const [items, setItems] = useState<Featured | null>(null);
  const [id, setId] = useState('');
  const [looking, setLooking] = useState(false);
  /** TMDB bulamazsa (ya da bağlı değilse) ad elle girilir. */
  const [manual, setManual] = useState<string | null>(null);
  useEffect(() => {
    if (q.data && !items) setItems(q.data);
  }, [q.data, items]);
  const save = useMutation({
    mutationFn: (list: Featured) => adminApi.setFeatured(list),
    onSuccess: (r) => {
      toast('Vitrin yayında', 'success', 'Uygulama ve web bir sonraki açılışta görür');
      playSound('ok');
      setItems(r);
      qc.invalidateQueries({ queryKey: ['admin', 'featured'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  if (!items) return <Card>{q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : <Rows n={5} />}</Card>;
  const dirty = JSON.stringify(items) !== JSON.stringify(q.data);
  const move = (i: number, by: number) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(i + by, 0, x);
    setItems(next);
  };
  async function add() {
    const t = id.trim();
    if (!/^\d+$/.test(t)) return toast('TMDB kimliği sayı olmalı (ör. 1396)', 'error');
    if (items!.some((f) => f.tmdbId === t)) return toast('Zaten vitrinde', 'error');
    setLooking(true);
    try {
      if (manual !== null) {
        if (manual.trim().length < 1) return;
        setItems([...(items ?? []), { tmdbId: t, kind: 'tv', title: manual.trim(), posterPath: null }]);
      } else {
        const s = await adminApi.lookupShow(t);
        setItems([...(items ?? []), { tmdbId: s.tmdbId, kind: 'tv', title: s.title, posterPath: s.posterPath }]);
      }
      setId('');
      setManual(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setManual('');
        toast('TMDB bu kimliği bulamadı', 'error', 'Adını elle yazıp ekleyebilirsin');
      } else toast(errorMessage(e), 'error');
    } finally {
      setLooking(false);
    }
  }
  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card
        title="Vitrin"
        sub={`${items.length}/30 · yukarıdaki önce görünür`}
        right={
          isAdmin &&
          dirty && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setItems(q.data ?? [])}>
                Geri al
              </Button>
              <Button size="sm" variant="primary" busy={save.isPending} onClick={() => save.mutate(items)}>
                Yayınla
              </Button>
            </>
          )
        }
      >
        {!items.length ? (
          <EmptyState
            icon="theaters"
            title="Vitrin boş"
            body="Ana sayfada öne çıkarmak istediğin dizileri ekle. Yapımlar listesindeki bir dizinin sayfasından da ekleyebilirsin."
          />
        ) : (
          items.map((f, i) => (
            <div key={f.tmdbId} className="flex items-center gap-3 px-[18px] py-2.5 shadow-[inset_0_0.5px_0_var(--color-line)]">
              <span className="w-5 text-center text-[13px] font-bold text-faint tabular">{i + 1}</span>
              <Poster path={f.posterPath} className="h-14 w-10 rounded-[6px]" />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => go(paths.show(f.tmdbId))}
                  className="block truncate text-left text-[14px] font-semibold hover:text-text"
                >
                  {f.title}
                </button>
                {isAdmin ? (
                  <input
                    className="mt-0.5 w-full bg-transparent text-[12px] text-sub outline-none placeholder:text-faint"
                    value={f.note ?? ''}
                    onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, note: e.target.value || undefined } : x)))}
                    placeholder="Kısa not ekle (ör. Final haftası)"
                    maxLength={120}
                  />
                ) : (
                  f.note && <p className="text-[12px] text-sub">{f.note}</p>
                )}
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  <Button size="xs" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Yukarı">
                    ↑
                  </Button>
                  <Button size="xs" variant="ghost" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Aşağı">
                    ↓
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setItems(items.filter((_, j) => j !== i))}>
                    Çıkar
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </Card>
      {isAdmin && (
        <Card title="Ekle">
          <form
            className="flex flex-col gap-2 px-[18px] pb-5"
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <input
              className={field}
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="TMDB kimliği (ör. 1396)"
              inputMode="numeric"
            />
            <Button type="submit" size="sm" variant="outline" icon="add_circle" busy={looking} disabled={!id.trim() || items.length >= 30}>
              {manual !== null ? 'Elle ekle' : 'Bul ve ekle'}
            </Button>
            <p className="text-[12px] text-faint">
              Kimliği themoviedb.org adresindeki sayıdan alabilirsin. Değişiklikler "Yayınla" deyince canlıya çıkar.
            </p>
          </form>
        </Card>
      )}
    </div>
  );
}
