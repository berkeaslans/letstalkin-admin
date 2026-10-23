import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/icon-names';
import { Card, EmptyState, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { Pills } from '@/components/ui/Tabs';
import { adminApi, type Report, type ReportStatus } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { timeAgo } from '@/lib/format';
import { playSound } from '@/lib/sound';
import { confirmAction, toast } from '@/stores/ui';
import { openUser } from './UserDrawer';

const REASON: Record<Report['reason'], [string, 'yellow' | 'epic' | 'live' | 'match' | 'blue' | undefined]> = {
  spam: ['Spam', 'yellow'],
  spoiler: ['Spoiler', 'epic'],
  harassment: ['Taciz', 'live'],
  hate: ['Nefret', 'live'],
  nudity: ['Müstehcen', 'match'],
  violence: ['Şiddet', 'live'],
  misinformation: ['Yanlış bilgi', 'blue'],
  other: ['Diğer', undefined],
};
const TARGET: Record<Report['targetType'], [string, IconName]> = {
  post: ['Gönderi', 'movie'],
  comment: ['Yorum', 'info'],
  user: ['Kullanıcı', 'person'],
  room: ['Oda', 'groups'],
  message: ['Mesaj', 'info'],
  stream: ['Yayın', 'tv'],
  story: ['Hikâye', 'visibility'],
};
/** Backend "kaldır" aksiyonunu yalnız bu hedeflerde uygular. */
const HIDEABLE: Report['targetType'][] = ['post', 'comment', 'room'];

const select =
  'h-[34px] rounded-full bg-elev2 pr-8 pl-3.5 text-[13px] font-semibold text-sub outline-none shadow-[inset_0_0_0_0.5px_var(--color-line2)] appearance-none bg-[length:10px] bg-[right_12px_center] bg-no-repeat';
const chevron = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23828489' stroke-width='1.5'/%3E%3C/svg%3E")`;

export function Reports() {
  const [status, setStatus] = useState<ReportStatus>('new');
  const [reason, setReason] = useState<Report['reason'] | 'all'>('all');
  const [target, setTarget] = useState<Report['targetType'] | 'all'>('all');
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'reports', status], queryFn: () => adminApi.reports(status), refetchInterval: 15_000 });

  const act = useMutation({
    mutationFn: ({ r, action }: { r: Report; action: 'none' | 'hide' | 'ban' }) =>
      adminApi.reportAction(r.id, action === 'none' ? 'reviewed' : 'actioned', action),
    onSuccess: (_, { action }) => {
      toast({ none: 'Yoksayıldı', hide: 'İçerik kaldırıldı', ban: 'Kullanıcı banlandı' }[action], action === 'ban' ? 'alert' : 'success');
      playSound(action === 'ban' ? 'warn' : 'ok');
      qc.invalidateQueries({ queryKey: ['admin', 'reports'] });
      qc.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  async function decide(r: Report, action: 'none' | 'hide' | 'ban') {
    if (action === 'ban') {
      const c = await confirmAction({
        title: 'Kullanıcı banlansın mı?',
        body: 'Tüm oturumları kapanır, içerikleri gizlenir ve giriş yapamaz. Karar denetim kaydına yazılır.',
        ok: 'Banla',
        danger: true,
      });
      if (!c.ok) return;
    }
    act.mutate({ r, action });
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
        list.map((r) => {
          const [rl, rt] = REASON[r.reason];
          const [tl, ti] = TARGET[r.targetType];
          const busy = act.isPending && act.variables?.r.id === r.id;
          return (
            <div key={r.id} className="flex flex-col gap-2.5 px-[18px] py-3.5 shadow-[inset_0_0.5px_0_var(--color-line)]">
              <div className="flex flex-wrap items-center gap-1.5">
                <Tag tone={rt}>{rl}</Tag>
                <Tag>
                  <Icon name={ti} size={13} />
                  {tl}
                </Tag>
                <span className="ml-1 text-[12px] text-faint">{timeAgo(r.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 rounded-[12px] bg-elev2 px-3 py-2.5 text-[12.5px] text-sub">
                <span className="min-w-0 flex-1 truncate">
                  Hedef kimliği <code className="text-[12px] text-text">{r.targetId}</code>
                </span>
                {r.targetType === 'user' && (
                  <Button size="xs" variant="ghost" onClick={() => openUser(r.targetId)}>
                    Profili aç
                    <Icon name="chevron_right" size={15} />
                  </Button>
                )}
              </div>
              {r.status === 'new' && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => decide(r, 'none')}>
                    Yoksay
                  </Button>
                  {HIDEABLE.includes(r.targetType) && (
                    <Button size="sm" icon="visibility_off" disabled={busy} onClick={() => decide(r, 'hide')}>
                      İçeriği kaldır
                    </Button>
                  )}
                  {r.targetType === 'user' && (
                    <Button size="sm" variant="danger" icon="block" disabled={busy} onClick={() => decide(r, 'ban')}>
                      Kullanıcıyı banla
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </Card>
  );
}
