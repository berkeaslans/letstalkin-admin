import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Avatar, Tick } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, EmptyState, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { Pills } from '@/components/ui/Tabs';
import { adminApi, type SeriesApp } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { compact, timeAgo } from '@/lib/format';
import { playSound } from '@/lib/sound';
import { confirmAction, toast } from '@/stores/ui';
import { openUser } from './UserPage';

type Status = SeriesApp['status'];

export function SeriesPages() {
  const [status, setStatus] = useState<Status>('pending');
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'series-pages', status], queryFn: () => adminApi.seriesPages(status) });
  const done = (msg: string) => {
    toast(msg);
    playSound('ok');
    qc.invalidateQueries({ queryKey: ['admin'] });
  };
  const fail = (e: unknown) => toast(errorMessage(e), 'error');
  const decide = useMutation({
    mutationFn: ({ a, approve, note }: { a: SeriesApp; approve: boolean; note: string }) => adminApi.decideSeriesPage(a.id, approve, note),
    onSuccess: (_, { a, approve }) =>
      done(approve ? (a.kind === 'official' ? 'Resmi sayfa onaylandı · sarı tik verildi' : 'Fan sayfası onaylandı') : 'Başvuru reddedildi'),
    onError: fail,
  });
  const revoke = useMutation({
    mutationFn: ({ a, note }: { a: SeriesApp; note: string }) => adminApi.revokeSeriesPage(a.id, note),
    onSuccess: () => done('Sayfa statüsü kaldırıldı'),
    onError: fail,
  });

  return (
    <Card>
      <div className="px-[18px] py-3.5">
        <Pills
          items={[
            { key: 'pending', label: 'Bekleyen' },
            { key: 'approved', label: 'Onaylı' },
            { key: 'rejected', label: 'Reddedilen' },
            { key: 'revoked', label: 'Kaldırılan' },
          ]}
          value={status}
          onChange={setStatus}
        />
      </div>
      {q.isLoading ? (
        <Rows n={3} />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState
          icon="movie"
          title={status === 'pending' ? 'Bekleyen başvuru yok' : 'Kayıt yok'}
          body={
            status === 'pending'
              ? 'Kullanıcılar bir dizinin fan ya da resmi sayfası olmak için başvurduğunda burada belirir. Onaylanan resmi sayfalar sarı tik alır ve oda, quiz açabilir.'
              : 'Bu durumda başvuru yok.'
          }
        />
      ) : (
        q.data.map((a) => (
          <div key={a.id} className="flex gap-3.5 px-[18px] py-4 shadow-[inset_0_0.5px_0_var(--color-line)]">
            {a.show.posterUrl ? (
              <img src={a.show.posterUrl} alt="" width={56} height={80} className="h-20 w-14 flex-none rounded-poster object-cover" />
            ) : (
              <span className="grid h-20 w-14 flex-none place-items-center rounded-poster bg-elev2">
                <Icon name="movie" size={22} className="text-faint" />
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {a.kind === 'official' ? (
                  <Tag tone="yellow">
                    <Icon name="verified" size={13} filled />
                    Resmi sayfa
                  </Tag>
                ) : (
                  <Tag>
                    <Icon name="groups" size={13} />
                    Fan sayfası
                  </Tag>
                )}
                <b className="text-[15px]">{a.show.title}</b>
                <span className="text-[12px] text-faint">{timeAgo(a.createdAt)}</span>
              </div>
              {a.user && (
                <button type="button" className="flex items-center gap-2.5 self-start text-left" onClick={() => openUser(a.user!.id)}>
                  <Avatar src={a.user.avatarPath} name={a.user.displayName ?? a.user.username} size={30} />
                  <span className="text-[13px]">
                    <b className="inline-flex items-center gap-1 font-semibold">
                      {a.user.displayName ?? a.user.username}
                      <Tick tick={a.user.tick} size={12} />
                    </b>
                    <span className="text-sub">
                      {' '}
                      · @{a.user.username} · {compact(a.user.followerCount)} takipçi
                    </span>
                  </span>
                </button>
              )}
              {a.reason && <p className="rounded-[12px] bg-elev2 px-3 py-2.5 text-[13px]">{a.reason}</p>}
              {a.evidenceUrl && (
                <a
                  href={a.evidenceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 self-start text-[12.5px] font-semibold text-yellow"
                >
                  Kanıt bağlantısı <Icon name="open_in_new" size={14} />
                </a>
              )}
              {a.reviewNote && <p className="text-[12.5px] text-sub">Not: {a.reviewNote}</p>}
              {status === 'pending' && (
                <>
                  <p className="text-[12px] text-faint">
                    {a.kind === 'official'
                      ? 'Onay hesabı resmi sayfaya çevirir ve sarı tik verir. Elle verilmiş tik varsa o korunur.'
                      : 'Onay hesabı fan sayfası yapar; oda ve quiz açabilir.'}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={async () => {
                        const c = await confirmAction({
                          title: 'Başvuru reddedilsin mi?',
                          body: 'Gerekçe kullanıcıya iletilir.',
                          ok: 'Reddet',
                          danger: true,
                          note: 'required',
                        });
                        if (c.ok) decide.mutate({ a, approve: false, note: c.note });
                      }}
                    >
                      Reddet
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      busy={decide.isPending && decide.variables?.a.id === a.id}
                      onClick={() => decide.mutate({ a, approve: true, note: '' })}
                    >
                      Onayla
                    </Button>
                  </div>
                </>
              )}
              {status === 'approved' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="self-start"
                  onClick={async () => {
                    const c = await confirmAction({
                      title: 'Sayfa statüsü kaldırılsın mı?',
                      body: `Hesap ${a.kind === 'official' ? 'resmi sayfa ve sarı tik' : 'fan sayfası'} statüsünü kaybeder. Açtığı odalar ve quizler kalır. Gerekçe kullanıcıya iletilir.`,
                      ok: 'Kaldır',
                      danger: true,
                      note: 'required',
                    });
                    if (c.ok) revoke.mutate({ a, note: c.note });
                  }}
                >
                  Statüyü kaldır
                </Button>
              )}
            </div>
          </div>
        ))
      )}
    </Card>
  );
}
