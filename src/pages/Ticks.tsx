import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { Pills } from '@/components/ui/Tabs';
import { adminApi, type Verification } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { compact, timeAgo } from '@/lib/format';
import { playSound } from '@/lib/sound';
import { confirmAction, toast } from '@/stores/ui';
import { openUser } from './UserPage';
import { UserTable } from './Users';

type Status = 'pending_review' | 'active' | 'rejected';

export function Ticks() {
  const [view, setView] = useState<'apps' | 'ticked'>('apps');
  return (
    <Card>
      <div className="px-[18px] py-3.5">
        <Pills
          items={[
            { key: 'apps', label: 'Mavi tik başvuruları' },
            { key: 'ticked', label: 'Tikli hesaplar' },
          ]}
          value={view}
          onChange={setView}
        />
      </div>
      {view === 'apps' ? (
        <Applications />
      ) : (
        <>
          <p className="px-[18px] pb-3 text-[12.5px] text-sub">
            Elle tik vermek veya kaldırmak için kişiye tıkla. Elle verilen tik resmi sayfa ve abonelik akışlarının önüne geçer.
          </p>
          <UserTable filter="tick" emptyTitle="Tikli hesap yok" />
        </>
      )}
    </Card>
  );
}

function Applications() {
  const [status, setStatus] = useState<Status>('pending_review');
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'verifications', status], queryFn: () => adminApi.verifications(status) });
  const decide = useMutation({
    mutationFn: ({ v, approve, note }: { v: Verification; approve: boolean; note: string }) =>
      adminApi.decideVerification(v.userId, approve, note),
    onSuccess: (_, { approve }) => {
      toast(approve ? 'Onaylandı · mavi tik verildi' : 'Başvuru reddedildi', approve ? 'success' : 'info', 'Kimlik belgesi silindi');
      playSound('ok');
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  return (
    <>
      <div className="px-[18px] pb-3">
        <Pills
          items={[
            { key: 'pending_review', label: 'İncelemede' },
            { key: 'active', label: 'Onaylı' },
            { key: 'rejected', label: 'Reddedilen' },
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
          icon="verified"
          title={status === 'pending_review' ? 'Bekleyen başvuru yok' : 'Kayıt yok'}
          body={
            status === 'pending_review'
              ? 'Mavi tik başvuruları kimlik belgesiyle gelir; belge yalnız karar anında görünür, profilde asla gösterilmez. Sarı tiki ise kişinin sayfasındaki Yönetim sekmesinden elle verirsin.'
              : 'Bu durumda başvuru yok.'
          }
        />
      ) : (
        q.data.map((v) => (
          <div key={v.userId} className="flex flex-col gap-3 px-[18px] py-4 shadow-[inset_0_0.5px_0_var(--color-line)]">
            <button type="button" className="flex items-center gap-3 text-left" onClick={() => openUser(v.userId)}>
              <Avatar src={v.user?.avatarPath} name={v.user?.displayName ?? v.user?.username ?? '?'} size={42} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[15px] font-semibold">
                  {v.user?.displayName ?? v.user?.username ?? 'Silinmiş hesap'}
                </p>
                <p className="text-[12.5px] text-sub">
                  @{v.user?.username} · {compact(v.user?.followerCount ?? 0)} takipçi · {timeAgo(v.createdAt)}
                </p>
              </div>
              <Tag tone={status === 'active' ? 'up' : status === 'rejected' ? 'live' : 'yellow'}>
                {status === 'active' ? 'Onaylı' : status === 'rejected' ? 'Reddedildi' : 'İncelemede'}
              </Tag>
            </button>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-[12px] bg-elev2 px-3 py-2.5 text-[13px]">
                <p className="text-[12px] text-sub">Beyan edilen ad</p>
                {v.fullName ?? '—'}
              </div>
              <div className="rounded-[12px] bg-elev2 px-3 py-2.5 text-[13px]">
                <p className="text-[12px] text-sub">Not</p>
                {v.note ?? '—'}
              </div>
            </div>
            {status === 'pending_review' && (
              <div className="flex flex-wrap items-center gap-2">
                {v.documentUrl ? (
                  <a
                    href={v.documentUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="press inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold shadow-[inset_0_0_0_0.5px_var(--color-line2)] hover:bg-elev2"
                  >
                    Kimliği aç
                  </a>
                ) : (
                  <span className="text-[12px] text-faint">Belge yüklenmemiş</span>
                )}
                <span className="text-[12px] text-faint">Bağlantı 5 dk geçerli, karardan sonra belge silinir</span>
                <div className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    variant="danger"
                    busy={decide.isPending && decide.variables?.v.userId === v.userId && !decide.variables.approve}
                    onClick={async () => {
                      const c = await confirmAction({
                        title: 'Başvuru reddedilsin mi?',
                        body: 'Gerekçe kullanıcıya iletilir.',
                        ok: 'Reddet',
                        danger: true,
                        note: 'required',
                      });
                      if (c.ok) decide.mutate({ v, approve: false, note: c.note });
                    }}
                  >
                    Reddet
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    icon="verified"
                    busy={decide.isPending && decide.variables?.v.userId === v.userId && decide.variables.approve}
                    onClick={() => decide.mutate({ v, approve: true, note: '' })}
                  >
                    Onayla
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </>
  );
}
