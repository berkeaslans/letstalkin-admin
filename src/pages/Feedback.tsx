// Geri bildirim kutusu: kullanıcıların hata, öneri ve soruları. Satıra tıklayınca
// açılır; yanıt kullanıcıya bildirim olarak gider.
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Avatar, Tick } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/icon-names';
import { Card, EmptyState, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { Pills } from '@/components/ui/Tabs';
import { adminApi, type Feedback, type FeedbackKind, type FeedbackStatus, mediaUrl } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/format';
import { go, paths } from '@/lib/go';
import { playSound } from '@/lib/sound';
import { toast } from '@/stores/ui';
import { area } from './Publish';

const KIND: Record<FeedbackKind, [string, IconName, 'live' | 'yellow' | 'blue' | undefined]> = {
  bug: ['Hata', 'error', 'live'],
  idea: ['Öneri', 'local_fire_department', 'yellow'],
  question: ['Soru', 'info', 'blue'],
  other: ['Diğer', 'campaign', undefined],
};
const PLATFORM: Record<string, string> = { ios: 'iOS', android: 'Android', web: 'Web' };

export function FeedbackInbox() {
  const [status, setStatus] = useState<FeedbackStatus | 'all'>('new');
  const [kind, setKind] = useState<FeedbackKind | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const q = useInfiniteQuery({
    queryKey: ['admin', 'feedback', status, kind],
    queryFn: ({ pageParam }) => adminApi.feedback({ status, kind: kind === 'all' ? undefined : kind, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  const counts = q.data?.pages[0]?.counts ?? {};
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 px-[18px] py-3.5">
        <Pills
          items={[
            { key: 'new', label: 'Yeni', count: counts.new },
            { key: 'seen', label: 'Bakıldı', count: counts.seen },
            { key: 'resolved', label: 'Çözüldü' },
            { key: 'all', label: 'Hepsi' },
          ]}
          value={status}
          onChange={setStatus}
        />
        <div className="ml-auto">
          <Pills
            items={[
              { key: 'all', label: 'Tümü' },
              { key: 'bug', label: 'Hata' },
              { key: 'idea', label: 'Öneri' },
              { key: 'question', label: 'Soru' },
            ]}
            value={kind}
            onChange={setKind}
          />
        </div>
      </div>
      {q.isLoading ? (
        <Rows />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !rows.length ? (
        <EmptyState title="Kutu boş" body="Uygulamadan ve webden gelen geri bildirimler burada anında belirir." />
      ) : (
        rows.map((f) => <Row key={f.id} f={f} open={open === f.id} toggle={() => setOpen(open === f.id ? null : f.id)} />)
      )}
      {q.hasNextPage && (
        <div className="flex justify-center p-4">
          <Button size="sm" variant="outline" busy={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
            Daha fazla
          </Button>
        </div>
      )}
    </Card>
  );
}

function Row({ f, open, toggle }: { f: Feedback; open: boolean; toggle: () => void }) {
  const qc = useQueryClient();
  const [reply, setReply] = useState('');
  const [label, icon, tone] = KIND[f.kind];
  const done = (msg: string) => ({
    onSuccess: () => {
      toast(msg);
      playSound('ok');
      qc.invalidateQueries({ queryKey: ['admin', 'feedback'] });
      qc.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
    onError: (e: unknown) => toast(errorMessage(e), 'error'),
  });
  const send = useMutation({
    mutationFn: (resolve: boolean) => adminApi.feedbackReply(f.id, reply.trim(), resolve),
    ...done('Yanıt gönderildi'),
  });
  const mark = useMutation({ mutationFn: (s: FeedbackStatus) => adminApi.feedbackStatus(f.id, s), ...done('Güncellendi') });
  // Açınca "bakıldı" sayılır ama liste yeniden çekilmez: satır gözünün önünden kaybolmasın.
  const seen = useMutation({
    mutationFn: () => adminApi.feedbackStatus(f.id, 'seen'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'overview'] }),
  });
  const shot = mediaUrl(f.screenshot);
  return (
    <div className={cn('shadow-[inset_0_0.5px_0_var(--color-line)]', open && 'bg-white/2')}>
      <button
        type="button"
        onClick={() => {
          toggle();
          if (!open && f.status === 'new') seen.mutate();
        }}
        className="flex w-full items-start gap-3 px-[18px] py-3 text-left hover:bg-white/3"
      >
        <span
          className={cn(
            'mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-full bg-elev2',
            tone === 'live' ? 'text-live' : tone === 'yellow' ? 'text-yellow' : 'text-sub',
          )}
        >
          <Icon name={icon} size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <Tag tone={tone}>{label}</Tag>
            {f.status === 'new' && <Tag tone="live">Yeni</Tag>}
            {f.status === 'resolved' && <Tag tone="up">Çözüldü</Tag>}
            <span className="text-[12px] text-faint">
              {f.user ? `@${f.user.username}` : 'anonim'} · {f.platform ? (PLATFORM[f.platform] ?? f.platform) : '—'}
              {f.appVersion ? ` ${f.appVersion}` : ''} · {timeAgo(f.createdAt)}
            </span>
          </span>
          <span className={cn('mt-1 block text-[13.5px] break-words whitespace-pre-line', !open && 'line-clamp-2')}>{f.text}</span>
        </span>
        <Icon name="expand_more" size={18} className={cn('mt-1 text-faint transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="flex flex-col gap-3 px-[18px] pb-4 pl-[62px]">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-sub">
            {f.route && (
              <span>
                Ekran: <code>{f.route}</code>
              </span>
            )}
            {f.device && <span>Cihaz: {f.device}</span>}
          </div>
          {shot && (
            <a href={shot} target="_blank" rel="noreferrer" className="block w-40 overflow-hidden rounded-[12px]">
              <img src={shot} alt="Ekran görüntüsü" className="w-full" />
            </a>
          )}
          {f.user && (
            <button
              type="button"
              onClick={() => go(paths.user(f.user!.id))}
              className="flex items-center gap-1.5 self-start text-[12.5px] text-sub hover:text-text"
            >
              <Avatar src={f.user.avatarPath} name={f.user.username} size={20} />
              <b className="text-text">@{f.user.username}</b>
              <Tick tick={f.user.tick} size={12} />
              profiline git
            </button>
          )}
          {f.reply ? (
            <div className="rounded-[14px] bg-elev2 px-3.5 py-2.5 text-[13px]">
              <p className="mb-0.5 text-[11.5px] text-faint">
                Yanıt · @{f.repliedBy?.username ?? 'ekip'} · {timeAgo(f.repliedAt)}
              </p>
              {f.reply}
            </div>
          ) : (
            f.user && (
              <form
                className="flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  send.mutate(true);
                }}
              >
                <textarea
                  className={cn(area, 'min-h-[72px]')}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Yanıtın kullanıcıya bildirim olarak gider"
                  maxLength={2000}
                />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" variant="primary" busy={send.isPending} disabled={reply.trim().length < 2}>
                    Yanıtla ve çöz
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={reply.trim().length < 2 || send.isPending}
                    onClick={() => send.mutate(false)}
                  >
                    Yalnız yanıtla
                  </Button>
                </div>
              </form>
            )
          )}
          <div className="flex gap-2">
            {f.status !== 'resolved' && (
              <Button size="xs" variant="outline" onClick={() => mark.mutate('resolved')}>
                Çözüldü işaretle
              </Button>
            )}
            {f.status === 'resolved' && (
              <Button size="xs" variant="ghost" onClick={() => mark.mutate('seen')}>
                Yeniden aç
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
