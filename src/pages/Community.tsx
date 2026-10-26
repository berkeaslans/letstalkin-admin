// Moderasyon · Topluluk içerikleri: kullanıcıların oluşturduğu listeler, karakter sıralamaları ve
// izleme kulüpleri. Uygunsuz başlık ya da spam için ara ve kaldır.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { Pills } from '@/components/ui/Tabs';
import { adminApi, type CommunityKind } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { confirmAction, toast } from '@/stores/ui';

const LABEL: Record<CommunityKind, string> = { lists: 'Listeler', tierlists: 'Karakter sıralamaları', clubs: 'İzleme kulüpleri' };
const COUNT: Record<CommunityKind, string> = { lists: 'yapım', tierlists: '', clubs: 'üye' };

export function Community() {
  const qc = useQueryClient();
  const [kind, setKind] = useState<CommunityKind>('lists');
  const [term, setTerm] = useState('');
  const q = useQuery({ queryKey: ['admin', 'community', kind, term], queryFn: () => adminApi.community(kind, term || undefined) });
  const del = useMutation({
    mutationFn: (id: string) => adminApi.deleteCommunity(kind, id),
    onSuccess: () => {
      toast('Kaldırıldı', 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'community', kind] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const rows = q.data ?? [];
  return (
    <Card
      title={
        <Pills items={(Object.keys(LABEL) as CommunityKind[]).map((k) => ({ key: k, label: LABEL[k] }))} value={kind} onChange={setKind} />
      }
    >
      <div className="px-[18px] pb-3">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Başlıkta ara"
          className="h-9 w-full max-w-[320px] rounded-option bg-elev2 px-3 text-[13px] outline-none shadow-[inset_0_0_0_0.5px_var(--color-line2)]"
        />
      </div>
      {q.isLoading ? (
        <Rows />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !rows.length ? (
        <EmptyState icon="inbox" title="Kayıt yok" body="Bu süzgece uyan içerik yok." />
      ) : (
        rows.map((r) => (
          <div key={r.id} className="flex items-start gap-3 px-[18px] py-3 shadow-[inset_0_0.5px_0_var(--color-line)]">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">
                {r.title} {!r.isPublic && <Tag>Gizli</Tag>}
              </p>
              <p className="text-[12px] text-faint">
                @{r.owner ?? '?'}
                {r.showTitle ? ` · ${r.showTitle}` : ''}
                {COUNT[kind] ? ` · ${r.count} ${COUNT[kind]}` : ''} · {new Date(r.createdAt).toLocaleDateString('tr-TR')}
              </p>
              {r.detail && <p className="mt-0.5 text-[13px] text-sub">{r.detail}</p>}
            </div>
            <Button
              size="sm"
              variant="ghost"
              icon="delete"
              aria-label="Kaldır"
              onClick={async () => {
                const c = await confirmAction({ title: 'Kaldırılsın mı?', body: 'Bu işlem geri alınamaz.', ok: 'Kaldır', danger: true });
                if (c.ok) del.mutate(r.id);
              }}
            />
          </div>
        ))
      )}
    </Card>
  );
}
