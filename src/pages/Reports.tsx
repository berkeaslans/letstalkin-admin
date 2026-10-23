import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Avatar, Tick } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/icon-names';
import { Card, EmptyState, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { Pills } from '@/components/ui/Tabs';
import { adminApi, mediaUrl, type Report, type ReportStatus } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/format';
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

export function Reports() {
  const [status, setStatus] = useState<ReportStatus>('new');
  const [reason, setReason] = useState<Report['reason'] | 'all'>('all');
  const [target, setTarget] = useState<Report['targetType'] | 'all'>('all');
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'reports', status], queryFn: () => adminApi.reports(status), refetchInterval: 15_000 });

  const act = useMutation({
    mutationFn: ({ r, action, note }: { r: Report; action: 'none' | 'hide' | 'ban'; note?: string }) =>
      adminApi.reportAction(r.id, action === 'none' ? 'reviewed' : 'actioned', action, note),
    onSuccess: (res, { action }) => {
      const what = { none: 'Yoksayıldı', hide: 'İçerik kaldırıldı', ban: 'Kullanıcı banlandı' }[action];
      toast(
        what,
        action === 'ban' ? 'alert' : 'success',
        res.closed > 1 ? `Aynı içerikle ilgili ${res.closed} şikayet birlikte kapandı` : undefined,
      );
      playSound(action === 'ban' ? 'warn' : 'ok');
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
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
  const list = all.filter((r) => (reason === 'all' || r.reason === reason) && (target === 'all' || r.targetType === target));

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
          onChange={setStatus}
        />
        <div className="ml-auto flex gap-2">
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
        </div>
      </div>

      {q.isLoading ? (
        <Rows />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !list.length ? (
        <EmptyState
          title="Kuyruk temiz"
          body={status === 'new' ? 'Bekleyen şikayet yok. Yenileri geldiğinde burada belirir ve ses çalar.' : 'Bu filtrede kayıt yok.'}
        />
      ) : (
        list.map((r) => <ReportRow key={r.id} r={r} busy={act.isPending && act.variables?.r.id === r.id} decide={decide} />)
      )}
    </Card>
  );
}

function ReportRow({ r, busy, decide }: { r: Report; busy: boolean; decide: (r: Report, a: 'none' | 'hide' | 'ban') => void }) {
  const [rl, rt] = REASON[r.reason];
  const [tl, ti] = TARGET[r.targetType];
  const t = r.target;
  const media = mediaUrl(t.media);
  const [blur, setBlur] = useState(r.reason === 'nudity' || r.reason === 'violence');
  return (
    <div className="flex flex-col gap-2.5 px-[18px] py-3.5 shadow-[inset_0_0.5px_0_var(--color-line)]">
      <div className="flex flex-wrap items-center gap-1.5">
        <Tag tone={rt}>{rl}</Tag>
        <Tag>
          <Icon name={ti} size={13} />
          {tl}
        </Tag>
        {r.pendingOnTarget > 1 && <Tag tone="live">{r.pendingOnTarget} kişi bildirdi</Tag>}
        {t.hidden && <Tag>{r.targetType === 'user' ? 'Banlı' : 'Gizli'}</Tag>}
        <span className="ml-1 text-[12px] text-faint">
          {r.reporter ? `@${r.reporter.username} · ` : ''}
          {timeAgo(r.createdAt)}
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
            <p className="text-[13px] text-faint">İçerik artık yok (silinmiş).</p>
          ) : (
            <>
              {t.author && (
                <button
                  type="button"
                  onClick={() => openUser(t.author!.id)}
                  className="mb-1 flex items-center gap-1.5 text-[12.5px] text-sub hover:text-text"
                >
                  <Avatar src={t.author.avatarPath} name={t.author.displayName ?? t.author.username} size={18} />
                  <b className="font-semibold text-text">@{t.author.username}</b>
                  <Tick tick={t.author.tick} size={12} />
                </button>
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
