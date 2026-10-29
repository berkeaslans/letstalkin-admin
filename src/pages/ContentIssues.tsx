// Moderasyon · Bilgi hataları: kullanıcıların "Bir hata mı var?" bildirimleri (otomatik üretilen
// quiz, anket, test, dizi bilgisi, tartışma sorusu). İçerik başına tek satır, en çok bildirilen üstte.
// Eşik (Kurallar sayfası) aşılınca içerik kendiliğinden gizlenir; buradan gizle, düzeltildi ya da reddet.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { Pills } from '@/components/ui/Tabs';
import { adminApi, type ContentIssue } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { timeAgo } from '@/lib/format';
import { go, paths } from '@/lib/go';
import { toast } from '@/stores/ui';

type Filter = 'active' | 'fixed' | 'dismissed' | 'all';
const TYPE: Record<ContentIssue['targetType'], string> = {
  quiz: 'Quiz',
  poll: 'Anket',
  post: 'Gönderi',
  personality: 'Kişilik testi',
  show: 'Dizi bilgisi',
};
const STATUS: Record<ContentIssue['status'], [string, 'live' | 'up' | 'yellow' | undefined]> = {
  open: ['Açık', 'yellow'],
  hidden: ['Gizlendi', 'live'],
  fixed: ['Düzeltildi', 'up'],
  dismissed: ['Reddedildi', undefined],
};

/** İçeriği panelde (ya da yalnız uygulamada varsa sitede) aç. */
function openTarget(i: ContentIssue) {
  if (i.targetType === 'quiz') go(paths.quiz(i.targetId));
  else if (i.targetType === 'post' || i.targetType === 'poll') go(paths.post(i.targetId));
  else if (i.targetType === 'show') go(paths.titleEdit(i.targetId));
  else window.open(`https://letstalkin.com/test/${i.targetId}`, '_blank', 'noopener');
}

export function ContentIssues() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>('active');
  const q = useQuery({ queryKey: ['admin', 'content-issues', filter], queryFn: () => adminApi.contentIssues(filter) });
  const act = useMutation({
    mutationFn: (v: { id: string; action: 'hide' | 'fix' | 'dismiss' }) => adminApi.issueAction(v.id, v.action),
    onSuccess: (_r, v) => {
      toast(v.action === 'hide' ? 'İçerik gizlendi' : v.action === 'fix' ? 'Düzeltildi olarak kapatıldı' : 'Bildirim reddedildi');
      qc.invalidateQueries({ queryKey: ['admin', 'content-issues'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const items = q.data?.items ?? [];
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 px-[18px] py-3.5">
        <Pills
          items={[
            { key: 'active', label: 'Bekleyen' },
            { key: 'fixed', label: 'Düzeltilen' },
            { key: 'dismissed', label: 'Reddedilen' },
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
      ) : !items.length ? (
        <EmptyState title="Bildirim yok" body="Quiz, anket, test ve dizi sayfalarındaki “Bir hata mı var?” bildirimleri burada toplanır." />
      ) : (
        items.map((i) => {
          const busy = act.isPending && act.variables?.id === i.id;
          const [label, tone] = STATUS[i.status];
          return (
            <div key={i.id} className="flex gap-4 border-t-[0.5px] border-line px-[18px] py-4">
              <div className="w-12 flex-none text-center">
                <p className="text-[24px] leading-none font-bold tabular-nums">{i.count}</p>
                <p className="mt-1 text-[11px] text-faint">bildirim</p>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Tag>{TYPE[i.targetType]}</Tag>
                  <Tag tone={tone}>{label}</Tag>
                  {i.autoHidden && <Tag tone="live">eşikle gizlendi</Tag>}
                  {i.showTitle && <span className="text-[12.5px] text-sub">{i.showTitle}</span>}
                  <span className="ml-auto text-[12px] text-faint">{timeAgo(i.lastAt)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => openTarget(i)}
                  className="press mt-1.5 block text-left text-[14px] font-semibold hover:underline"
                >
                  {i.preview || i.targetId}
                </button>
                <ul className="mt-2 flex flex-col gap-1">
                  {i.reports.map((r, k) => (
                    <li key={k} className="text-[12.5px] text-sub">
                      <span className="text-faint">{r.guest ? 'misafir' : r.username ? `@${r.username}` : 'silinmiş hesap'}</span>
                      {r.detail && <span className="text-faint"> · {r.detail}</span>}
                      {r.text ? <span className="text-text"> — {r.text}</span> : <span className="text-faint"> — not yok</span>}
                    </li>
                  ))}
                </ul>
                {(i.status === 'open' || i.status === 'hidden') && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {i.status === 'open' && i.targetType !== 'show' && (
                      <Button
                        size="sm"
                        variant="danger"
                        busy={busy && act.variables?.action === 'hide'}
                        onClick={() => act.mutate({ id: i.id, action: 'hide' })}
                      >
                        Gizle
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="primary"
                      busy={busy && act.variables?.action === 'fix'}
                      onClick={() => act.mutate({ id: i.id, action: 'fix' })}
                    >
                      {i.status === 'hidden' ? 'Düzeltildi, yayına al' : 'Düzeltildi'}
                    </Button>
                    <Button
                      size="sm"
                      busy={busy && act.variables?.action === 'dismiss'}
                      onClick={() => act.mutate({ id: i.id, action: 'dismiss' })}
                    >
                      Reddet
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </Card>
  );
}
