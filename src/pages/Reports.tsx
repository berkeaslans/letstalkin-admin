// Şikayet kuyruğu. Her satırda içeriğin kendisi, şikayet edenin sicili ve
// içerik sahibinin sicili durur — karar vermek için sayfadan çıkmak gerekmez.
// Klavye: j/k gez, x seç, e yoksay, h kaldır, Enter profil.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Avatar, Tick } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/icon-names';
import { Card, EmptyState, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { SavedViews } from '@/components/ui/SavedViews';
import { Pills } from '@/components/ui/Tabs';
import { adminApi, mediaUrl, type Report, type ReportStatus } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/format';
import { useKeys } from '@/lib/shortcuts';
import { playSound } from '@/lib/sound';
import { confirmAction, toast } from '@/stores/ui';
import { openUser } from './UserPage';

export const REASON: Record<Report['reason'], [string, 'yellow' | 'epic' | 'live' | 'match' | 'blue' | undefined]> = {
  spam: ['Spam', 'yellow'],
  spoiler: ['Spoiler', 'epic'],
  harassment: ['Taciz', 'live'],
  hate: ['Nefret', 'live'],
  nudity: ['Müstehcen', 'match'],
  violence: ['Şiddet', 'live'],
  misinformation: ['Yanlış bilgi', 'blue'],
  other: ['Diğer', undefined],
};
export const TARGET: Record<Report['targetType'], [string, IconName]> = {
  post: ['Gönderi', 'movie'],
  comment: ['Yorum', 'info'],
  user: ['Kullanıcı', 'person'],
  room: ['Oda', 'groups'],
  message: ['Mesaj', 'info'],
  stream: ['Yayın', 'tv'],
  story: ['Hikâye', 'visibility'],
};
/** Backend "kaldır"ı bu hedeflerde uygular (oda arşivlenir, hikâye ve mesaj silinir). */
const HIDEABLE: Report['targetType'][] = ['post', 'comment', 'room', 'story', 'message'];

const select =
  'h-[34px] appearance-none rounded-full bg-elev2 bg-[length:10px] bg-[right_12px_center] bg-no-repeat pr-8 pl-3.5 text-[13px] font-semibold text-sub outline-none shadow-[inset_0_0_0_0.5px_var(--color-line2)]';
const chevron = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23828489' stroke-width='1.5'/%3E%3C/svg%3E")`;

type Sort = 'new' | 'old' | 'most';

export function Reports() {
  const [status, setStatus] = useState<ReportStatus>('new');
  const [reason, setReason] = useState<Report['reason'] | 'all'>('all');
  const [target, setTarget] = useState<Report['targetType'] | 'all'>('all');
  const [sort, setSort] = useState<Sort>('new');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(0);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'reports', status], queryFn: () => adminApi.reports(status), refetchInterval: 15_000 });

  const done = (msg: string, tone: 'success' | 'alert' = 'success', sub?: string) => {
    toast(msg, tone, sub);
    playSound(tone === 'alert' ? 'warn' : 'ok');
    setPicked(new Set());
    qc.invalidateQueries({ queryKey: ['admin'] });
  };
  const act = useMutation({
    mutationFn: ({ r, action, note }: { r: Report; action: 'none' | 'hide' | 'ban'; note?: string }) =>
      adminApi.reportAction(r.id, action === 'none' ? 'reviewed' : 'actioned', action, note),
    onSuccess: (res, { action }) => {
      const what = { none: 'Yoksayıldı', hide: 'İçerik kaldırıldı', ban: 'Kullanıcı banlandı' }[action];
      done(
        what,
        action === 'ban' ? 'alert' : 'success',
        res.closed > 1 ? `Aynı içerikle ilgili ${res.closed} şikayet birlikte kapandı` : undefined,
      );
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const bulk = useMutation({
    mutationFn: ({ ids, action, note }: { ids: string[]; action: 'none' | 'hide'; note?: string }) =>
      adminApi.bulkReports(ids, action === 'none' ? 'reviewed' : 'actioned', action, note),
    onSuccess: (r) =>
      done(
        `${r.closed} şikayet kapandı`,
        'success',
        [r.hidden ? `${r.hidden} içerik kaldırıldı` : '', r.failed ? `${r.failed} hedefe uygulanamadı` : ''].filter(Boolean).join(' · ') ||
          undefined,
      ),
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  async function decide(r: Report, action: 'none' | 'hide' | 'ban') {
    if (action === 'none') return act.mutate({ r, action });
    const c = await confirmAction(
      action === 'ban'
        ? {
            title: 'Kullanıcı banlansın mı?',
            body: 'Tüm oturumları kapanır, içerikleri gizlenir ve giriş yapamaz.',
            ok: 'Banla',
            danger: true,
            note: 'optional',
          }
        : {
            title: 'İçerik kaldırılsın mı?',
            body:
              r.targetType === 'room'
                ? 'Oda arşivlenir; sahibine bildirim gider. Odalar ekranından geri açılabilir.'
                : r.targetType === 'post' || r.targetType === 'comment'
                  ? 'İçerik gizlenir, sahibine gerekçeli bildirim gider. İçerik ekranından geri alınabilir.'
                  : 'Kalıcı olarak silinir ve sahibine bildirim gider. Geri alınamaz.',
            ok: 'Kaldır',
            danger: true,
            note: 'optional',
          },
    );
    if (c.ok) act.mutate({ r, action, note: c.note });
  }

  const all = q.data ?? [];
  const list = useMemo(() => {
    const rows = all.filter((r) => (reason === 'all' || r.reason === reason) && (target === 'all' || r.targetType === target));
    if (sort === 'old') return [...rows].reverse();
    if (sort === 'most') return [...rows].sort((a, b) => b.pendingOnTarget - a.pendingOnTarget);
    return rows;
  }, [all, reason, target, sort]);

  // Silinmiş içeriğe gelen şikayetler: bakılacak bir şey yok, tek tıkla temizlenir.
  const ghosts = list.filter((r) => r.target.missing).map((r) => r.id);
  const atCursor = list[Math.min(cursor, list.length - 1)];
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  useKeys(
    {
      j: () => setCursor((c) => Math.min(list.length - 1, c + 1)),
      k: () => setCursor((c) => Math.max(0, c - 1)),
      x: () => atCursor && toggle(atCursor.id),
      e: () => atCursor && decide(atCursor, 'none'),
      h: () => {
        if (atCursor && HIDEABLE.includes(atCursor.targetType) && !atCursor.target.missing && !atCursor.target.hidden)
          decide(atCursor, 'hide');
      },
      enter: () => atCursor?.target.author && openUser(atCursor.target.author.id),
    },
    status === 'new' && !!list.length,
  );

  const busy = act.isPending || bulk.isPending;
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 px-[18px] py-3.5">
        <Pills
          items={[
            { key: 'new', label: 'Yeni', count: status === 'new' ? all.length : undefined },
            { key: 'reviewed', label: 'İncelendi', count: status === 'reviewed' ? all.length : undefined },
            { key: 'actioned', label: 'İşlem yapıldı', count: status === 'actioned' ? all.length : undefined },
          ]}
          value={status}
          onChange={(s) => {
            setStatus(s);
            setPicked(new Set());
            setCursor(0);
          }}
        />
        <div className="ml-auto flex flex-wrap gap-2">
          <select
            aria-label="Sebep"
            className={select}
            style={{ backgroundImage: chevron }}
            value={reason}
            onChange={(e) => setReason(e.target.value as typeof reason)}
          >
            <option value="all">Tüm sebepler</option>
            {Object.entries(REASON).map(([k, v]) => (
              <option key={k} value={k}>
                {v[0]}
              </option>
            ))}
          </select>
          <select
            aria-label="Hedef"
            className={select}
            style={{ backgroundImage: chevron }}
            value={target}
            onChange={(e) => setTarget(e.target.value as typeof target)}
          >
            <option value="all">Tüm hedefler</option>
            {Object.entries(TARGET).map(([k, v]) => (
              <option key={k} value={k}>
                {v[0]}
              </option>
            ))}
          </select>
          <select
            aria-label="Sıralama"
            className={select}
            style={{ backgroundImage: chevron }}
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
          >
            <option value="new">Önce yeni</option>
            <option value="old">Önce eski</option>
            <option value="most">Çok bildirilen</option>
          </select>
        </div>
      </div>

      <div className="px-[18px] pb-3">
        <SavedViews
          page="reports"
          query={{ status, reason, target, sort }}
          onApply={(v) => {
            setStatus((v.status as ReportStatus) ?? 'new');
            setReason((v.reason as Report['reason']) ?? 'all');
            setTarget((v.target as Report['targetType']) ?? 'all');
            setSort((v.sort as Sort) ?? 'new');
          }}
        />
      </div>
      {status === 'new' && !!list.length && (
        <div className="flex flex-wrap items-center gap-2 px-[18px] pb-3 text-[12.5px] text-sub">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="accent-yellow"
              checked={picked.size > 0 && picked.size === list.length}
              ref={(el) => {
                if (el) el.indeterminate = picked.size > 0 && picked.size < list.length;
              }}
              onChange={(e) => setPicked(e.target.checked ? new Set(list.map((r) => r.id)) : new Set())}
            />
            {picked.size ? `${picked.size} seçildi` : 'Tümünü seç'}
          </label>
          {picked.size > 0 && (
            <>
              <Button
                size="xs"
                variant="outline"
                busy={bulk.isPending}
                onClick={async () => {
                  const c = await confirmAction({
                    title: `${picked.size} şikayet yoksayılsın mı?`,
                    body: 'İncelendi olarak kapanır, içeriklere dokunulmaz.',
                    ok: 'Yoksay',
                    note: 'optional',
                  });
                  if (c.ok) bulk.mutate({ ids: [...picked], action: 'none', note: c.note });
                }}
              >
                Yoksay
              </Button>
              <Button
                size="xs"
                variant="danger"
                busy={bulk.isPending}
                onClick={async () => {
                  const c = await confirmAction({
                    title: `${picked.size} şikayetin içeriği kaldırılsın mı?`,
                    body: 'Gönderi ve yorumlar gizlenir, odalar arşivlenir, hikâye ve mesajlar silinir. Sahiplerine bildirim gider.',
                    ok: 'Kaldır',
                    danger: true,
                    note: 'optional',
                  });
                  if (c.ok) bulk.mutate({ ids: [...picked], action: 'hide', note: c.note });
                }}
              >
                İçerikleri kaldır
              </Button>
              <button type="button" className="text-faint hover:text-text" onClick={() => setPicked(new Set())}>
                Seçimi bırak
              </button>
            </>
          )}
          {!picked.size && ghosts.length > 1 && (
            <Button size="xs" variant="ghost" onClick={() => setPicked(new Set(ghosts))}>
              Silinmiş içeriğe gelen {ghosts.length} şikayeti seç
            </Button>
          )}
          <span className="ml-auto hidden text-[11.5px] text-faint lg:block">j/k gez · x seç · e yoksay · h kaldır</span>
        </div>
      )}

      {q.isLoading ? (
        <Rows />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !list.length ? (
        <EmptyState
          title={status === 'new' ? 'Kuyruk temiz' : 'Bu filtrede kayıt yok'}
          body={
            status === 'new'
              ? 'Bekleyen şikayet yok. Biri uygulamada bir gönderiyi, yorumu, odayı ya da kişiyi bildirdiğinde burada anında belirir ve ses çalar.'
              : 'Filtreyi genişletmeyi dene; kapanan şikayetler sebep ve hedefe göre süzülüyor.'
          }
        />
      ) : (
        list.map((r, i) => (
          <ReportRow
            key={r.id}
            r={r}
            busy={busy && act.variables?.r.id === r.id}
            decide={decide}
            picked={picked.has(r.id)}
            onPick={status === 'new' ? () => toggle(r.id) : undefined}
            focused={status === 'new' && atCursor?.id === r.id}
            onFocus={() => setCursor(i)}
          />
        ))
      )}
    </Card>
  );
}

/** Şikayetçinin sicili: kaç şikayet etti, kaçı haklı çıktı. */
function Reporter({ r }: { r: Report }) {
  if (!r.reporter) return <span className="text-[12px] text-faint">silinmiş hesap bildirdi</span>;
  const { username, total, actioned, noisy } = r.reporter;
  const rate = total ? Math.round((actioned / total) * 100) : 0;
  return (
    <span
      className="flex items-center gap-1.5 text-[12px] text-faint"
      title={`@${username} bugüne kadar ${total} şikayet etti, ${actioned} tanesinde işlem yapıldı`}
    >
      <button type="button" onClick={() => openUser(r.reporter!.id)} className="hover:text-sub">
        @{username}
      </button>
      {total > 1 && (
        <span className={cn(noisy && 'text-live')}>
          · {total} şikayet{total >= 3 ? `, %${rate} haklı` : ''}
        </span>
      )}
      {noisy && <Tag tone="live">Gürültücü</Tag>}
    </span>
  );
}

function ReportRow({
  r,
  busy,
  decide,
  picked,
  onPick,
  focused,
  onFocus,
}: {
  r: Report;
  busy: boolean;
  decide: (r: Report, a: 'none' | 'hide' | 'ban') => void;
  picked: boolean;
  onPick?: () => void;
  focused: boolean;
  onFocus: () => void;
}) {
  const [rl, rt] = REASON[r.reason];
  const [tl, ti] = TARGET[r.targetType];
  const t = r.target;
  const media = mediaUrl(t.media);
  const [blur, setBlur] = useState(r.reason === 'nudity' || r.reason === 'violence');
  const h = r.authorHistory;
  return (
    <div
      onMouseDown={onFocus}
      className={cn(
        'flex flex-col gap-2.5 px-[18px] py-3.5 shadow-[inset_0_0.5px_0_var(--color-line)]',
        picked && 'bg-yellow/6',
        focused && 'shadow-[inset_2px_0_0_var(--color-yellow),inset_0_0.5px_0_var(--color-line)]',
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {onPick && <input type="checkbox" aria-label="Seç" className="mr-1 accent-yellow" checked={picked} onChange={onPick} />}
        <Tag tone={rt}>{rl}</Tag>
        <Tag>
          <Icon name={ti} size={13} />
          {tl}
        </Tag>
        {r.pendingOnTarget > 1 && <Tag tone="live">{r.pendingOnTarget} kişi bildirdi</Tag>}
        {t.hidden && <Tag>{r.targetType === 'user' ? 'Banlı' : 'Gizli'}</Tag>}
        {t.missing && <Tag>İçerik silinmiş</Tag>}
        <span className="ml-1 flex flex-wrap items-center gap-1.5">
          <Reporter r={r} />
          <span className="text-[12px] text-faint">· {timeAgo(r.createdAt)}</span>
        </span>
      </div>

      <div className="flex gap-3 rounded-[12px] bg-elev2 px-3 py-2.5">
        {media && (
          <button
            type="button"
            onClick={() => setBlur(!blur)}
            className="relative h-16 w-16 flex-none overflow-hidden rounded-[10px] bg-elev3"
            title={blur ? 'Görmek için tıkla' : 'Gizle'}
          >
            <img src={media} alt="" className={cn('h-full w-full object-cover transition-[filter]', blur && 'blur-lg')} />
            {blur && <Icon name="visibility_off" size={18} className="absolute inset-0 m-auto text-white/80" />}
          </button>
        )}
        <div className="min-w-0 flex-1">
          {t.missing ? (
            <p className="text-[13px] text-faint">
              İçerik artık yok (silinmiş). Karar vermeye gerek yok; yoksayarak kuyruktan düşürebilirsin.
            </p>
          ) : (
            <>
              {t.author && (
                <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <button
                    type="button"
                    onClick={() => openUser(t.author!.id)}
                    className="flex items-center gap-1.5 text-[12.5px] text-sub hover:text-text"
                  >
                    <Avatar src={t.author.avatarPath} name={t.author.displayName ?? t.author.username} size={18} />
                    <b className="font-semibold text-text">@{t.author.username}</b>
                    <Tick tick={t.author.tick} size={12} />
                  </button>
                  {h && (
                    <span className="flex items-center gap-1.5 text-[11.5px] text-faint">
                      {h.isBanned && <Tag tone="live">Banlı</Tag>}
                      {h.hasViolation && <Tag tone="live">İhlal geçmişi</Tag>}
                      {h.reports > 0 && (
                        <span className={cn(h.actioned > 0 && 'text-live')}>
                          {h.reports} şikayet{h.actioned ? ` · ${h.actioned} işlem` : ''}
                        </span>
                      )}
                      <span>· {timeAgo(h.joinedAt)} katıldı</span>
                    </span>
                  )}
                </div>
              )}
              {t.title && r.targetType !== 'user' && <p className="text-[12px] font-semibold text-sub">{t.title}</p>}
              <p className="text-[13.5px] break-words whitespace-pre-line text-[#dcdce0]">
                {t.text || <span className="text-faint">Metin yok</span>}
              </p>
            </>
          )}
        </div>
      </div>

      {r.status === 'new' && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => decide(r, 'none')}>
            Yoksay
          </Button>
          {HIDEABLE.includes(r.targetType) && !t.missing && !t.hidden && (
            <Button size="sm" icon="visibility_off" disabled={busy} onClick={() => decide(r, 'hide')}>
              {r.targetType === 'room' ? 'Odayı arşivle' : 'İçeriği kaldır'}
            </Button>
          )}
          {r.targetType === 'user' && !t.hidden && (
            <Button size="sm" variant="danger" icon="block" disabled={busy} onClick={() => decide(r, 'ban')}>
              Kullanıcıyı banla
            </Button>
          )}
          {t.author && (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => openUser(t.author!.id)}>
              Profil
              <Icon name="chevron_right" size={15} />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
