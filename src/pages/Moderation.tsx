// Moderasyon ekranları: İçerik, Odalar, Eşleşme, Kurallar (kara liste + eşik), Özet.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Avatar, Tick } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, EmptyState, ErrorState, LiveTag, Rows, Stat, Tag } from '@/components/ui/misc';
import { Switch } from '@/components/ui/Switch';
import { Pills, Segment } from '@/components/ui/Tabs';
import { adminApi, type ContentItem, type HideKind, mediaUrl, type PostDetail, type RoomDetail } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { compact, fmt, timeAgo } from '@/lib/format';
import { go, paths } from '@/lib/go';
import { type RoomMessage, useLive, watchRoom } from '@/lib/realtime';
import { playSound } from '@/lib/sound';
import { useIsAdmin } from '@/stores/session';
import { confirmAction, toast } from '@/stores/ui';
import { PRIVACY, ROOM_KIND } from './Publish';
import { REASON, TARGET } from './Reports';
import { openUser } from './UserPage';

const field =
  'h-10 w-full rounded-full bg-elev2 px-3.5 text-[13.5px] outline-none shadow-[inset_0_0_0_0.5px_var(--color-line2)] placeholder:text-faint focus:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.32)]';

function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}
function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex h-10 w-full max-w-[380px] items-center gap-2 rounded-full bg-elev2 px-3.5 shadow-[inset_0_0_0_0.5px_var(--color-line2)]">
      <Icon name="search" size={19} className="text-faint" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-faint"
      />
    </label>
  );
}
function Author({
  a,
}: {
  a: { id: string; username: string; displayName: string | null; avatarPath: string | null; tick: 'none' | 'yellow' | 'blue' } | null;
}) {
  if (!a) return <span className="text-[12.5px] text-faint">silinmiş hesap</span>;
  return (
    <button type="button" onClick={() => openUser(a.id)} className="flex items-center gap-1.5 text-[12.5px] text-sub hover:text-text">
      <Avatar src={a.avatarPath} name={a.displayName ?? a.username} size={20} />
      <b className="font-semibold text-text">@{a.username}</b>
      <Tick tick={a.tick} size={12} />
    </button>
  );
}
function useMod() {
  const qc = useQueryClient();
  return (msg: string) => ({
    onSuccess: () => {
      toast(msg);
      playSound('ok');
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e: unknown) => toast(errorMessage(e), 'error'),
  });
}

// ---------------- İçerik ----------------
export function Content() {
  const [type, setType] = useState<'post' | 'comment'>('post');
  const [state, setState] = useState<'all' | 'visible' | 'hidden'>('all');
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim());
  const ok = useMod();
  const res = useInfiniteQuery({
    queryKey: ['admin', 'content', type, state, term],
    queryFn: ({ pageParam }) => adminApi.content({ type, state, q: term || undefined, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const hide = useMutation({
    mutationFn: ({ i, note }: { i: ContentItem; note: string }) => adminApi.hide(i.kind, i.id, note),
    ...ok('Kaldırıldı · sahibine bildirim gitti'),
  });
  const restore = useMutation({ mutationFn: (i: ContentItem) => adminApi.restore(i.kind, i.id), ...ok('Geri alındı') });
  const items = res.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 px-[18px] py-3.5">
        <Pills
          items={[
            { key: 'post', label: 'Gönderiler' },
            { key: 'comment', label: 'Yorumlar' },
          ]}
          value={type}
          onChange={setType}
        />
        <div className="ml-auto">
          <Pills
            items={[
              { key: 'all', label: 'Hepsi' },
              { key: 'visible', label: 'Yayında' },
              { key: 'hidden', label: 'Gizlenen' },
            ]}
            value={state}
            onChange={setState}
          />
        </div>
      </div>
      <div className="px-[18px] pb-3">
        <Search value={q} onChange={setQ} placeholder="Metinde ara veya @kullanıcı" />
      </div>
      {res.isLoading ? (
        <Rows />
      ) : res.isError ? (
        <ErrorState error={res.error} retry={() => res.refetch()} />
      ) : !items.length ? (
        <EmptyState
          icon="search"
          title="Sonuç yok"
          body="Metinde ara ya da @kullanıcı adı yaz. Gizlenen içerikler için yukarıdaki 'Gizlenen' filtresine geç."
        />
      ) : (
        items.map((i) => (
          <div key={i.id} className="flex gap-3 px-[18px] py-3.5 shadow-[inset_0_0.5px_0_var(--color-line)]">
            {mediaUrl(i.media) && <img src={mediaUrl(i.media)!} alt="" className="h-14 w-14 flex-none rounded-[10px] object-cover" />}
            <div
              className={cn('flex min-w-0 flex-1 flex-col gap-1', i.kind === 'post' && 'cursor-pointer')}
              onClick={i.kind === 'post' ? () => go(paths.post(i.id)) : undefined}
              onKeyDown={i.kind === 'post' ? (e) => e.key === 'Enter' && go(paths.post(i.id)) : undefined}
              role={i.kind === 'post' ? 'link' : undefined}
              tabIndex={i.kind === 'post' ? 0 : undefined}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Author a={i.author} />
                {i.hidden && <Tag tone="live">Gizli</Tag>}
                {i.reportCount > 0 && <Tag tone="yellow">{i.reportCount} şikayet</Tag>}
              </div>
              <p className="line-clamp-3 text-[13.5px] break-words">{i.text || <span className="text-faint">Metin yok</span>}</p>
              <p className="text-[12px] text-faint">
                {i.meta} · {timeAgo(i.createdAt)}
              </p>
            </div>
            <div className="flex-none self-center">
              {i.hidden ? (
                <Button
                  size="sm"
                  variant="outline"
                  busy={restore.isPending && restore.variables?.id === i.id}
                  onClick={() => restore.mutate(i)}
                >
                  Geri al
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="danger"
                  icon="visibility_off"
                  onClick={async () => {
                    const c = await confirmAction({
                      title: 'İçerik kaldırılsın mı?',
                      body: 'Gizlenir; sahibine gerekçeli bildirim gider. Buradan geri alınabilir.',
                      ok: 'Kaldır',
                      danger: true,
                      note: 'optional',
                    });
                    if (c.ok) hide.mutate({ i, note: c.note });
                  }}
                >
                  Kaldır
                </Button>
              )}
            </div>
          </div>
        ))
      )}
      {res.hasNextPage && (
        <div className="flex justify-center p-4">
          <Button size="sm" variant="outline" busy={res.isFetchingNextPage} onClick={() => res.fetchNextPage()}>
            Daha fazla
          </Button>
        </div>
      )}
    </Card>
  );
}

// ---------------- Tek gönderi ----------------
// Bildirimden ya da akıştan tıklanınca gelinen yer: gönderinin kendisi, kimin
// şikayet ettiği ve yorumları bir arada; moderasyon kararı buradan verilir.
const POST_TYPE: Record<string, string> = {
  post: 'Gönderi',
  review: 'İnceleme',
  quote: 'Alıntı',
  poll: 'Anket',
  clip: 'Klip',
};

export function PostPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ['admin', 'post', id], queryFn: () => adminApi.post(id!), enabled: !!id });
  const ok = useMod();
  const hide = useMutation({
    mutationFn: (note: string) => adminApi.hide('post', id!, note),
    ...ok('Kaldırıldı · sahibine bildirim gitti'),
  });
  const restore = useMutation({ mutationFn: () => adminApi.restore('post', id!), ...ok('Geri alındı') });
  const hideComment = useMutation({
    mutationFn: ({ cid, note }: { cid: string; note: string }) => adminApi.hide('comment', cid, note),
    ...ok('Yorum kaldırıldı'),
  });
  const restoreComment = useMutation({ mutationFn: (cid: string) => adminApi.restore('comment', cid), ...ok('Yorum geri alındı') });

  if (q.isLoading)
    return (
      <Card>
        <Rows n={8} />
      </Card>
    );
  if (q.isError || !q.data)
    return (
      <Card>
        <ErrorState error={q.error} retry={() => q.refetch()} />
      </Card>
    );
  const d: PostDetail = q.data;
  const toplamOy = d.poll.reduce((n, o) => n + o.voteCount, 0);

  return (
    <div className="flex flex-col gap-3.5">
      <Card
        title={POST_TYPE[d.type] ?? d.type}
        sub={timeAgo(d.createdAt)}
        right={
          d.hidden ? (
            <Button size="sm" variant="outline" busy={restore.isPending} onClick={() => restore.mutate()}>
              Geri al
            </Button>
          ) : (
            <Button
              size="sm"
              variant="danger"
              icon="visibility_off"
              busy={hide.isPending}
              onClick={async () => {
                const c = await confirmAction({
                  title: 'Gönderi kaldırılsın mı?',
                  body: 'Gizlenir; sahibine gerekçeli bildirim gider. Buradan geri alınabilir.',
                  ok: 'Kaldır',
                  danger: true,
                  note: 'optional',
                });
                if (c.ok) hide.mutate(c.note);
              }}
            >
              Kaldır
            </Button>
          )
        }
      >
        <div className="flex flex-col gap-3 px-[18px] pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <Author a={d.author} />
            {d.hidden && <Tag tone="live">Gizli</Tag>}
            {d.isSpoiler && <Tag tone="epic">Spoiler{d.spoilerNote ? ` · ${d.spoilerNote}` : ''}</Tag>}
            {d.editedAt && <Tag>düzenlendi</Tag>}
            {d.language !== 'tr' && <Tag>{d.language}</Tag>}
          </div>

          {d.show && (
            <Link
              to={paths.show(d.show.tmdbId)}
              className="flex w-fit items-center gap-2 rounded-option bg-elev2 py-1.5 pr-3 pl-1.5 hover:bg-white/6"
            >
              {d.show.posterPath ? (
                <img
                  src={`https://image.tmdb.org/t/p/w92${d.show.posterPath}`}
                  alt=""
                  className="h-9 w-6 flex-none rounded-[4px] object-cover"
                />
              ) : (
                <Icon name="theaters" size={18} className="text-faint" />
              )}
              <span className="text-[13px] font-semibold">{d.show.name}</span>
              {d.episodeTag && <span className="text-[12px] text-sub">{d.episodeTag}</span>}
            </Link>
          )}

          {d.quote && <blockquote className="border-yellow/50 border-l-2 pl-3 text-[14px] text-sub italic">{d.quote}</blockquote>}
          {d.text ? (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed break-words">{d.text}</p>
          ) : (
            !d.quote && <p className="text-[13px] text-faint">Metin yok</p>
          )}
          {d.rating != null && (
            <p className="text-[13.5px]">
              <b className="text-yellow">{d.rating.toFixed(1)}</b> <span className="text-sub">puan</span>
            </p>
          )}

          {!!d.media.length && (
            <div className="flex flex-wrap gap-2">
              {d.media.map((m) => (
                <a key={m} href={mediaUrl(m) ?? undefined} target="_blank" rel="noreferrer">
                  <img src={mediaUrl(m) ?? undefined} alt="" className="h-40 w-40 rounded-[12px] object-cover" />
                </a>
              ))}
            </div>
          )}

          {!!d.poll.length && (
            <div className="flex flex-col gap-1.5">
              {d.poll.map((o) => (
                <div key={o.label} className="relative overflow-hidden rounded-option bg-elev2 px-3 py-2">
                  <div
                    className="absolute inset-y-0 left-0 bg-yellow/14"
                    style={{ width: `${toplamOy ? Math.round((o.voteCount / toplamOy) * 100) : 0}%` }}
                  />
                  <div className="relative flex justify-between text-[13.5px]">
                    <span>{o.label}</span>
                    <span className="text-sub">
                      {fmt(o.voteCount)} oy{toplamOy ? ` · %${Math.round((o.voteCount / toplamOy) * 100)}` : ''}
                    </span>
                  </div>
                </div>
              ))}
              <p className="text-[12px] text-faint">
                {fmt(toplamOy)} oy
                {d.pollEndsAt ? ` · ${new Date(d.pollEndsAt) > new Date() ? 'bitiş' : 'bitti'} ${timeAgo(d.pollEndsAt)}` : ''}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3.5 px-[18px] pb-5 lg:grid-cols-4">
          <Stat icon="check_circle" label="Beğeni" value={compact(d.likeCount)} />
          <Stat icon="info" label="Yorum" value={compact(d.commentCount)} />
          <Stat icon="swap_horiz" label="Paylaşım" value={compact(d.shareCount)} />
          <Stat icon="add_circle" label="Kaydetme" value={compact(d.saveCount)} />
        </div>
      </Card>

      {!!d.reports.length && (
        <Card title={`Şikayetler · ${d.reports.length}`} sub="en yeniden eskiye">
          {d.reports.map((r) => {
            const [label, tone] = REASON[r.reason as keyof typeof REASON] ?? [r.reason, undefined];
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-2 px-[18px] py-2.5 shadow-[inset_0_0.5px_0_var(--color-line)]">
                <Tag tone={tone}>{label}</Tag>
                <Author a={r.reporter} />
                <span className="ml-auto text-[12px] text-faint">{timeAgo(r.createdAt)}</span>
              </div>
            );
          })}
        </Card>
      )}

      <Card
        title={`Yorumlar · ${d.comments.length}`}
        sub={d.commentCount > d.comments.length ? `${fmt(d.commentCount)} yorumun ilki` : undefined}
      >
        {!d.comments.length ? (
          <EmptyState icon="info" title="Yorum yok" body="Bu gönderiye henüz kimse yorum yazmamış." />
        ) : (
          d.comments.map((c) => (
            <div key={c.id} className="flex gap-3 px-[18px] py-3 shadow-[inset_0_0.5px_0_var(--color-line)]">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Author a={c.author} />
                  {c.hidden && <Tag tone="live">Gizli</Tag>}
                  {c.reportCount > 0 && <Tag tone="yellow">{c.reportCount} şikayet</Tag>}
                </div>
                <p className="whitespace-pre-wrap text-[13.5px] break-words">{c.text}</p>
                <p className="text-[12px] text-faint">
                  {fmt(c.likeCount)} beğeni · {timeAgo(c.createdAt)}
                </p>
              </div>
              <div className="flex-none self-center">
                {c.hidden ? (
                  <Button size="xs" variant="outline" onClick={() => restoreComment.mutate(c.id)}>
                    Geri al
                  </Button>
                ) : (
                  <Button
                    size="xs"
                    variant="ghost"
                    icon="visibility_off"
                    onClick={async () => {
                      const conf = await confirmAction({
                        title: 'Yorum kaldırılsın mı?',
                        body: 'Gizlenir; sahibine gerekçeli bildirim gider.',
                        ok: 'Kaldır',
                        danger: true,
                        note: 'optional',
                      });
                      if (conf.ok) hideComment.mutate({ cid: c.id, note: conf.note });
                    }}
                  >
                    Kaldır
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

// ---------------- Odalar ----------------

export function Rooms() {
  const isAdmin = useIsAdmin();
  const [status, setStatus] = useState<'active' | 'archived' | 'reported' | 'all'>('active');
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim());
  const res = useInfiniteQuery({
    queryKey: ['admin', 'rooms', status, term],
    queryFn: ({ pageParam }) => adminApi.rooms({ status, q: term || undefined, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const rows = res.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 px-[18px] py-3.5">
        <Pills
          items={[
            { key: 'active', label: 'Aktif' },
            { key: 'reported', label: 'Şikayetli' },
            { key: 'archived', label: 'Arşiv' },
            { key: 'all', label: 'Hepsi' },
          ]}
          value={status}
          onChange={setStatus}
        />
        {isAdmin && (
          <Link to="/yayin?tur=oda" className="ml-auto">
            <Button size="sm" variant="primary" icon="add_circle">
              Oda aç
            </Button>
          </Link>
        )}
      </div>
      <div className="px-[18px] pb-3">
        <Search value={q} onChange={setQ} placeholder="Oda adı" />
      </div>
      {res.isLoading ? (
        <Rows />
      ) : res.isError ? (
        <ErrorState error={res.error} retry={() => res.refetch()} />
      ) : !rows.length ? (
        <EmptyState
          icon="groups"
          title="Oda yok"
          body="Bu filtrede oda bulunamadı. Kullanıcılar sarı tikli, dizi sayfası, güvenilir ya da takipçi eşiğini geçmişse oda açabilir; sen de Yayın ekranından hesap seçerek açabilirsin."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="text-left text-[12px] text-faint">
                <th className="px-[18px] py-2.5 font-semibold">Oda</th>
                <th className="px-3 py-2.5 font-semibold">Sahip</th>
                <th className="px-3 py-2.5 text-right font-semibold">Üye</th>
                <th className="px-3 py-2.5 text-right font-semibold">Mesaj</th>
                <th className="px-[18px] py-2.5 font-semibold">Durum</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer shadow-[inset_0_0.5px_0_var(--color-line)] hover:bg-white/3"
                  onClick={() => go(paths.room(r.id))}
                >
                  <td className="px-[18px] py-2.5">
                    <p className="font-semibold">{r.name}</p>
                    <p className="text-[12px] text-faint">
                      {PRIVACY[r.privacy]} · {timeAgo(r.createdAt)}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{r.owner ? `@${r.owner.username}` : '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular">{compact(r.memberCount)}</td>
                  <td className="px-3 py-2.5 text-right tabular">{compact(r.messageCount)}</td>
                  <td className="px-[18px] py-2.5">
                    <div className="flex gap-1.5">
                      {r.status === 'active' ? <Tag tone="up">Aktif</Tag> : <Tag>Arşiv</Tag>}
                      {r.reportCount > 0 && <Tag tone="live">{r.reportCount} şikayet</Tag>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {res.hasNextPage && (
        <div className="flex justify-center p-4">
          <Button size="sm" variant="outline" busy={res.isFetchingNextPage} onClick={() => res.fetchNextPage()}>
            Daha fazla
          </Button>
        </div>
      )}
    </Card>
  );
}

export function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const isAdmin = useIsAdmin();
  // Mesajlar canlı gelir (socket). Yoklama yalnız bağlantı koptuğunda devreye girer.
  const connected = useLive((s) => s.status === 'live');
  const q = useQuery({
    queryKey: ['admin', 'room', id],
    queryFn: () => adminApi.room(id!),
    enabled: !!id,
    refetchInterval: connected ? false : 8_000,
  });
  const qc = useQueryClient();
  // Canlı düşen mesajlar listenin başına eklenir; kimlikle tekrarı önlenir.
  const [fresh, setFresh] = useState<RoomMessage[]>([]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: oda değişince biriken mesajlar sıfırlanır
  useEffect(() => setFresh([]), [id]);
  useEffect(() => {
    if (!id || !connected) return;
    return watchRoom(id, (m) => {
      setFresh((cur) => (cur.some((x) => x.id === m.id) ? cur : [m, ...cur].slice(0, 100)));
      // Üye ve mesaj sayacı da tazelensin (sessizce).
      qc.invalidateQueries({ queryKey: ['admin', 'rooms'] });
    });
  }, [id, connected, qc]);
  const ok = useMod();
  const status = useMutation({
    mutationFn: ({ s, note }: { s: 'active' | 'archived'; note: string }) => adminApi.roomStatus(id!, s, note),
    ...ok('Oda güncellendi'),
  });
  const remove = useMutation({ mutationFn: (userId: string) => adminApi.removeMember(id!, userId), ...ok('Üye çıkarıldı') });
  const owner = useMutation({ mutationFn: (userId: string) => adminApi.roomOwner(id!, userId), ...ok('Sahiplik devredildi') });
  const delMsg = useMutation({ mutationFn: (msgId: string) => adminApi.hide('room_message' as HideKind, msgId), ...ok('Mesaj silindi') });
  const r = q.data;
  if (q.isLoading)
    return (
      <Card>
        <Rows n={8} />
      </Card>
    );
  if (q.isError || !r)
    return (
      <Card>
        <ErrorState error={q.error} retry={() => q.refetch()} />
      </Card>
    );
  const seen = new Set(r.messages.map((m) => m.id));
  const merged = [...fresh.filter((m) => !seen.has(m.id)), ...r.messages];
  return (
    <div className="flex flex-col gap-3.5">
      <Card>
        <div className="flex flex-wrap items-start gap-4 px-[18px] py-5">
          <span className="grid h-14 w-14 flex-none place-items-center rounded-[16px] bg-yellow/12 text-yellow">
            <Icon name="groups" size={28} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <h2 className="text-[20px] font-bold tracking-[-0.3px]">{r.name}</h2>
            {r.description && <p className="text-[13.5px] text-sub">{r.description}</p>}
            <div className="flex flex-wrap items-center gap-1.5">
              {r.status === 'active' ? <Tag tone="up">Aktif</Tag> : <Tag>Arşiv</Tag>}
              <Tag>{ROOM_KIND[r.kind]}</Tag>
              <Tag>{PRIVACY[r.privacy]}</Tag>
              {r.reportCount > 0 && <Tag tone="live">{r.reportCount} şikayet</Tag>}
              {r.pendingRequests > 0 && <Tag tone="yellow">{r.pendingRequests} katılma isteği</Tag>}
              {r.closesAt && <Tag>kapanış {new Date(r.closesAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</Tag>}
              <span className="text-[12px] text-faint">
                · {fmt(r.memberCount)} üye · {fmt(r.messageCount)} mesaj · {timeAgo(r.createdAt)} açıldı
              </span>
            </div>
            {r.owner && (
              <div className="pt-1">
                <Author a={r.owner} />
              </div>
            )}
          </div>
          <Button
            size="sm"
            variant={r.status === 'active' ? 'danger' : 'secondary'}
            busy={status.isPending}
            onClick={async () => {
              const archive = r.status === 'active';
              const c = await confirmAction({
                title: archive ? 'Oda arşivlensin mi?' : 'Oda yeniden açılsın mı?',
                body: archive ? 'Mesaj gönderimi durur; üyeler geçmişi görebilir.' : 'Oda yeniden aktif olur.',
                ok: archive ? 'Arşivle' : 'Aç',
                danger: archive,
                note: 'optional',
              });
              if (c.ok) status.mutate({ s: archive ? 'archived' : 'active', note: c.note });
            }}
          >
            {r.status === 'active' ? 'Odayı arşivle' : 'Odayı yeniden aç'}
          </Button>
        </div>
      </Card>

      <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card
          title="Mesajlar"
          sub={connected ? <LiveTag /> : <span className="text-[12px] text-faint">bağlantı yok · 8 sn'de bir yenileniyor</span>}
        >
          {isAdmin && r.status === 'active' && <SendAs roomId={r.id} members={r.members.map((m) => m.id)} />}
          <div className="max-h-[640px] overflow-y-auto">
            {merged.length ? (
              merged.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    'flex items-start gap-3 px-[18px] py-2.5 shadow-[inset_0_0.5px_0_var(--color-line)]',
                    fresh.some((x) => x.id === m.id) && 'feed-in',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <Author a={m.author} />
                    <p className="mt-0.5 text-[13.5px] break-words">{m.text}</p>
                    <p className="text-[11.5px] text-faint">{timeAgo(m.createdAt)}</p>
                  </div>
                  <Button size="xs" variant="ghost" onClick={() => delMsg.mutate(m.id)}>
                    Sil
                  </Button>
                </div>
              ))
            ) : (
              <EmptyState icon="info" title="Mesaj yok" body="Bu odada henüz kimse yazmamış." />
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card title="Üyeler" sub={`${fmt(r.memberCount)} kişi`}>
            <div className="max-h-[420px] overflow-y-auto">
              {r.members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-[18px] py-2.5 shadow-[inset_0_0.5px_0_var(--color-line)]">
                  <Avatar src={m.avatarPath} name={m.displayName ?? m.username} size={30} />
                  <button type="button" className="min-w-0 flex-1 text-left text-[13.5px]" onClick={() => openUser(m.id)}>
                    <p className="flex items-center gap-1.5 truncate font-semibold">
                      @{m.username}
                      <Tick tick={m.tick} size={12} />
                    </p>
                    <p className="text-[12px] text-faint">{m.role === 'owner' ? 'Sahip' : m.role === 'admin' ? 'Yönetici' : 'Üye'}</p>
                  </button>
                  {m.role !== 'owner' && (
                    <div className="flex gap-1.5">
                      {isAdmin && (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={async () => {
                            const c = await confirmAction({
                              title: `@${m.username} sahip olsun mu?`,
                              body: 'Eski sahip oda yöneticisi olur.',
                              ok: 'Devret',
                            });
                            if (c.ok) owner.mutate(m.id);
                          }}
                        >
                          Sahip yap
                        </Button>
                      )}
                      <Button
                        size="xs"
                        variant="danger"
                        busy={remove.isPending && remove.variables === m.id}
                        onClick={() => remove.mutate(m.id)}
                      >
                        Çıkar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
          {isAdmin && (
            <Card title="Ayarlar">
              <RoomSettings key={r.id} r={r} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function SendAs({ roomId, members }: { roomId: string; members: string[] }) {
  const accounts = useQuery({ queryKey: ['admin', 'publish', 'accounts'], queryFn: adminApi.publishAccounts });
  const usable = (accounts.data?.accounts ?? []).filter((a) => members.includes(a.id));
  const [as, setAs] = useState<string | null>(null);
  const [text, setText] = useState('');
  const chosen = usable.find((a) => a.id === as) ?? usable[0];
  const send = useMutation({
    mutationFn: () => adminApi.publishRoomMessage(roomId, chosen!.id, text.trim()),
    ...useMod()('Mesaj gönderildi'),
    onSettled: () => setText(''),
  });
  if (!usable.length) return null;
  return (
    <form
      className="flex flex-col gap-2 px-[18px] pb-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) send.mutate();
      }}
    >
      <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-sub">
        Hesap adına yaz:
        {usable.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAs(a.id)}
            className={cn('rounded-full px-2.5 py-1 font-semibold', chosen?.id === a.id ? 'bg-yellow/14 text-yellow' : 'bg-elev2 text-sub')}
          >
            @{a.username}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input className={field} value={text} onChange={(e) => setText(e.target.value)} placeholder="Odaya mesaj" maxLength={1000} />
        <Button type="submit" variant="primary" busy={send.isPending} disabled={!text.trim()}>
          Gönder
        </Button>
      </div>
    </form>
  );
}

function RoomSettings({ r }: { r: RoomDetail }) {
  const [name, setName] = useState(r.name);
  const [desc, setDesc] = useState(r.description ?? '');
  const [privacy, setPrivacy] = useState<keyof typeof PRIVACY>(r.privacy);
  const [spoilerRule, setSpoilerRule] = useState(r.spoilerRule ?? '');
  const [summary, setSummary] = useState(r.summaryEnabled);
  const save = useMutation({
    mutationFn: () =>
      adminApi.editRoom(r.id, {
        name: name.trim(),
        description: desc.trim() || null,
        privacy,
        spoilerRule: spoilerRule.trim() || null,
        summaryEnabled: summary,
      }),
    ...useMod()('Oda ayarları kaydedildi'),
  });
  return (
    <form
      className="flex flex-col gap-3 px-[18px] pb-5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-sub">
        Oda adı
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      </label>
      <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-sub">
        Açıklama
        <input className={field} value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={300} />
      </label>
      <div className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-sub">
        Gizlilik
        <Segment
          value={privacy}
          onChange={setPrivacy}
          items={(Object.keys(PRIVACY) as Array<keyof typeof PRIVACY>).map((k) => ({ key: k, label: PRIVACY[k] }))}
        />
      </div>
      <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold text-sub">
        Spoiler kuralı
        <input className={field} value={spoilerRule} onChange={(e) => setSpoilerRule(e.target.value)} maxLength={120} />
      </label>
      <div className="flex items-center justify-between text-[13px]">
        <span>Yapay zekâ özeti</span>
        <Switch checked={summary} onChange={setSummary} label="Yapay zekâ özeti" />
      </div>
      <Button type="submit" variant="primary" className="self-end" busy={save.isPending} disabled={name.trim().length < 2}>
        Kaydet
      </Button>
    </form>
  );
}

// ---------------- Eşleşme ----------------
export function Match() {
  const [filter, setFilter] = useState<'reported' | 'mismatch' | 'inactive' | 'all'>('reported');
  const ok = useMod();
  const q = useQuery({ queryKey: ['admin', 'match', filter], queryFn: () => adminApi.matchProfiles(filter) });
  const toggle = useMutation({
    mutationFn: ({ id, active, note }: { id: string; active: boolean; note: string }) => adminApi.matchActive(id, active, note),
    ...ok('Eşleşme profili güncellendi'),
  });
  return (
    <Card>
      <div className="px-[18px] py-3.5">
        <Pills
          items={[
            { key: 'reported', label: 'Şikayetli' },
            { key: 'mismatch', label: 'Yaş tutarsız' },
            { key: 'inactive', label: 'Kapalı' },
            { key: 'all', label: 'Hepsi' },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>
      {q.isLoading ? (
        <Rows />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState title="Kayıt yok" body={filter === 'reported' ? 'Şikayetli eşleşme profili yok.' : undefined} />
      ) : (
        q.data.map((p) => (
          <div key={p.user.id} className="flex items-center gap-3 px-[18px] py-3 shadow-[inset_0_0.5px_0_var(--color-line)]">
            <Avatar src={p.user.avatarPath} name={p.user.displayName ?? p.user.username} size={36} />
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openUser(p.user.id)}>
              <p className="text-[14px] font-semibold">
                {p.name ?? p.user.username}, {p.age}
                {p.city && <span className="font-normal text-sub"> · {p.city}</span>}
              </p>
              <p className="text-[12px] text-faint">
                @{p.user.username} · {p.photoCount} fotoğraf · {timeAgo(p.updatedAt)}
              </p>
            </button>
            <div className="flex flex-wrap justify-end gap-1.5">
              {p.ageMismatch && <Tag tone="live">Yaş tutarsız</Tag>}
              {p.reportCount > 0 && <Tag tone="yellow">{p.reportCount} şikayet</Tag>}
              {!p.isActive && <Tag>Kapalı</Tag>}
            </div>
            <Button
              size="sm"
              variant={p.isActive ? 'danger' : 'secondary'}
              onClick={async () => {
                const c = await confirmAction({
                  title: p.isActive ? 'Eşleşme profili kapatılsın mı?' : 'Profil yeniden açılsın mı?',
                  body: p.isActive ? 'Kullanıcı keşfette görünmez, yeni eşleşme alamaz.' : 'Kullanıcı yeniden keşfette görünür.',
                  ok: p.isActive ? 'Kapat' : 'Aç',
                  danger: p.isActive,
                  note: 'optional',
                });
                if (c.ok) toggle.mutate({ id: p.user.id, active: !p.isActive, note: c.note });
              }}
            >
              {p.isActive ? 'Kapat' : 'Aç'}
            </Button>
          </div>
        ))
      )}
    </Card>
  );
}

// ---------------- Kurallar ----------------
export function Rules() {
  const isAdmin = useIsAdmin();
  const ok = useMod();
  const s = useQuery({ queryKey: ['admin', 'modsettings'], queryFn: adminApi.modSettings });
  const list = useQuery({ queryKey: ['admin', 'blocklist'], queryFn: adminApi.blocklist });
  const [th, setTh] = useState<number | null>(null);
  const [kind, setKind] = useState<'link' | 'word'>('link');
  const [pattern, setPattern] = useState('');
  const [testText, setTestText] = useState('');
  const [testRes, setTestRes] = useState<string | null | undefined>(undefined);
  const save = useMutation({ mutationFn: (n: number) => adminApi.setModSettings({ autoHideThreshold: n }), ...ok('Eşik kaydedildi') });
  const add = useMutation({
    mutationFn: () => adminApi.addBlocked(kind, pattern.trim()),
    ...ok('Kara listeye eklendi'),
    onSettled: () => setPattern(''),
  });
  const del = useMutation({ mutationFn: (id: string) => adminApi.removeBlocked(id), ...ok('Kara listeden çıkarıldı') });
  const current = th ?? s.data?.autoHideThreshold ?? 0;

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-2">
      <Card title="Otomatik gizleme" sub="Topluluk şikayetiyle hızlı müdahale">
        <div className="flex flex-col gap-3 px-[18px] pb-5">
          <p className="text-[13.5px] text-sub">
            Bir gönderi ya da yoruma bu kadar <b className="text-text">farklı kişi</b> şikayet edince içerik incelemeye kadar gizlenir.
            Sahibine bildirim gitmez; karar senin. Aynı kişinin tekrar şikayeti sayılmaz.
          </p>
          {s.isLoading ? (
            <Rows n={1} />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {[0, 3, 5, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => setTh(n)}
                  className={cn(
                    'press h-9 rounded-full px-4 text-[13px] font-semibold disabled:opacity-60',
                    current === n ? 'bg-text text-black' : 'bg-elev2 text-sub shadow-[inset_0_0_0_0.5px_var(--color-line2)]',
                  )}
                >
                  {n === 0 ? 'Kapalı' : `${n} kişi`}
                </button>
              ))}
              {isAdmin && th !== null && th !== s.data?.autoHideThreshold && (
                <Button size="sm" variant="primary" busy={save.isPending} onClick={() => save.mutate(th)}>
                  Kaydet
                </Button>
              )}
            </div>
          )}
          {!isAdmin && <p className="text-[12px] text-faint">Eşiği yalnız admin değiştirebilir.</p>}
        </div>
      </Card>

      <Card title="Kara liste" sub="Gönderi, yorum, oda mesajı, DM, hikâye ve profilde uygulanır">
        <div className="flex flex-col gap-3 px-[18px] pb-4">
          {isAdmin && (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (pattern.trim().length >= 2) add.mutate();
              }}
            >
              <div className="w-[220px]">
                <Segment
                  value={kind}
                  onChange={setKind}
                  items={[
                    { key: 'link', label: 'Bağlantı' },
                    { key: 'word', label: 'Kelime' },
                  ]}
                />
              </div>
              <div className="flex gap-2">
                <input
                  className={field}
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder={kind === 'link' ? 'ör. wa.me/90555 veya ucuztakipci.com' : 'ör. tam kelime'}
                  maxLength={120}
                />
                <Button type="submit" variant="primary" busy={add.isPending} disabled={pattern.trim().length < 2}>
                  Ekle
                </Button>
              </div>
              <p className="text-[12px] text-faint">
                {kind === 'link'
                  ? 'Metnin herhangi bir yerinde geçerse yakalanır.'
                  : 'Yalnız tam kelime yakalanır: "kötü" "kötülük"ü engellemez.'}
              </p>
            </form>
          )}
          {list.isLoading ? (
            <Rows n={3} />
          ) : !list.data?.length ? (
            <EmptyState
              icon="shield"
              title="Liste boş"
              body="Spam bağlantıları (ör. takipçi satan siteler) ve istemediğin kelimeleri ekle. Eklediğin an gönderi, yorum, oda mesajı, DM, hikâye ve profil metinlerinde uygulanır — kullanıcı neye takıldığını görmez."
            />
          ) : (
            <div className="overflow-hidden rounded-[14px] bg-elev2">
              {list.data.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-3.5 py-2.5 text-[13.5px] shadow-[inset_0_-0.5px_0_var(--color-line)]">
                  <Tag tone={t.kind === 'link' ? 'blue' : undefined}>{t.kind === 'link' ? 'Bağlantı' : 'Kelime'}</Tag>
                  <div className="min-w-0 flex-1">
                    <code className="block truncate text-[13px]">{t.pattern}</code>
                    <p className="truncate text-[11.5px] text-faint">
                      {t.note ? `${t.note} · ` : ''}
                      {t.createdBy ? `@${t.createdBy.username}` : 'silinmiş hesap'} · {timeAgo(t.createdAt)}
                    </p>
                  </div>
                  <span
                    className={cn('flex-none text-right text-[12px] tabular', t.hitCount ? 'font-semibold text-up' : 'text-faint')}
                    title={t.hitCount ? `Son yakalama: ${timeAgo(t.lastHitAt)}` : 'Bu kural henüz hiçbir içeriği engellemedi'}
                  >
                    {t.hitCount ? `${fmt(t.hitCount)} yakalama` : '—'}
                  </span>
                  {isAdmin && (
                    <Button size="xs" variant="ghost" onClick={() => del.mutate(t.id)}>
                      Kaldır
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2 pt-2">
            <p className="text-[12.5px] font-semibold text-sub">Dene</p>
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setTestRes((await adminApi.testBlocked(testText)).match);
              }}
            >
              <input
                className={field}
                value={testText}
                onChange={(e) => {
                  setTestText(e.target.value);
                  setTestRes(undefined);
                }}
                placeholder="Bir metin yapıştır"
              />
              <Button type="submit" variant="outline" disabled={!testText.trim()}>
                Dene
              </Button>
            </form>
            {testRes !== undefined && (
              <p className={cn('text-[13px] font-semibold', testRes ? 'text-live' : 'text-up')}>
                {testRes ? `Takılır: "${testRes}"` : 'Geçer — listedeki hiçbir terime takılmıyor'}
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ---------------- Özet ----------------
function Bars({ rows, label }: { rows: Array<{ key: string; count: number }>; label: (k: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.length) return <p className="px-[18px] pb-4 text-[13px] text-faint">Kayıt yok</p>;
  return (
    <div className="flex flex-col gap-2.5 px-[18px] pb-4">
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[110px_minmax(0,1fr)_44px] items-center gap-3 text-[13px]">
          <span className="truncate text-sub">{label(r.key)}</span>
          <span className="h-2 overflow-hidden rounded-full bg-elev3">
            <span className="block h-full rounded-full bg-yellow" style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className="text-right tabular">{fmt(r.count)}</span>
        </div>
      ))}
    </div>
  );
}

export function Summary() {
  const [days, setDays] = useState<'7' | '30' | '90'>('7');
  const q = useQuery({ queryKey: ['admin', 'modsummary', days], queryFn: () => adminApi.modSummary(Number(days)) });
  const s = q.data;
  return (
    <>
      <Pills
        items={[
          { key: '7', label: 'Son 7 gün' },
          { key: '30', label: 'Son 30 gün' },
          { key: '90', label: 'Son 90 gün' },
        ]}
        value={days}
        onChange={setDays}
      />
      {q.isError ? (
        <Card>
          <ErrorState error={q.error} retry={() => q.refetch()} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
            <Stat label="Gelen şikayet" icon="crisis_alert" value={s ? fmt(s.received) : '—'} />
            <Stat label="Şu an açık" icon="schedule" value={s ? fmt(s.open) : '—'} tone={s?.open ? 'live' : undefined} />
            <Stat
              label="Ortanca karar süresi"
              icon="bolt"
              value={s ? (s.medianDecisionMinutes === null ? '—' : `${fmt(s.medianDecisionMinutes)} dk`) : '—'}
            />
            <Stat
              label="Kararlar"
              icon="check_circle"
              value={s ? fmt(s.decisions.dismissed + s.decisions.removed + s.decisions.banned) : '—'}
              sub={s ? `${s.decisions.removed} kaldırma · ${s.decisions.banned} ban · ${s.decisions.autoHidden} otomatik` : undefined}
            />
          </div>
          <div className="grid items-start gap-3.5 lg:grid-cols-2">
            <Card title="Sebebe göre">
              {s ? <Bars rows={s.byReason} label={(k) => REASON[k as keyof typeof REASON]?.[0] ?? k} /> : <Rows n={3} />}
            </Card>
            <Card title="Türe göre">
              {s ? <Bars rows={s.byTarget} label={(k) => TARGET[k as keyof typeof TARGET]?.[0] ?? k} /> : <Rows n={3} />}
            </Card>
            <Card title="En çok şikayet edilen hesaplar">
              {!s ? (
                <Rows n={3} />
              ) : !s.topReported.length ? (
                <EmptyState title="Kimse yok" body="Bu dönemde hakkında şikayet açılan kullanıcı olmadı." />
              ) : (
                s.topReported.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => openUser(u.id)}
                    className="flex w-full items-center gap-3 px-[18px] py-2.5 text-left shadow-[inset_0_0.5px_0_var(--color-line)] hover:bg-white/3"
                  >
                    <Avatar src={u.avatarPath} name={u.displayName ?? u.username} size={30} />
                    <span className="flex-1 text-[13.5px] font-semibold">@{u.username}</span>
                    <Tag tone="live">{u.count} şikayet</Tag>
                  </button>
                ))
              )}
            </Card>
            <Card title="Ekibin kararları">
              {!s ? (
                <Rows n={3} />
              ) : !s.moderators.length ? (
                <EmptyState
                  title="Bu dönemde karar yok"
                  body="Şikayetlere karar verildikçe hangi moderatörün kaç karar verdiği burada görünür."
                />
              ) : (
                s.moderators.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 px-[18px] py-2.5 text-[13.5px] shadow-[inset_0_0.5px_0_var(--color-line)]"
                  >
                    <span className="flex-1 font-semibold">@{m.username}</span>
                    <span className="tabular">{fmt(m.count)} karar</span>
                  </div>
                ))
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
