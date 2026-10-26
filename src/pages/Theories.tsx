// Yaklaşanlar · Teoriler: uygulamadaki dizi teorileri. Bölüm yayınlanınca "Doğru çıktı" ya da
// "Çürüdü" işaretle; doğru çıkan teorinin sahibi o haftanın liderlik tablosunda 100 puan alır.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { Pills } from '@/components/ui/Tabs';
import { type AdminTheory, adminApi } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { playSound } from '@/lib/sound';
import { confirmAction, toast } from '@/stores/ui';

type Filter = 'open' | 'confirmed' | 'debunked' | 'all';

export function Theories() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>('open');
  const q = useQuery({ queryKey: ['admin', 'theories', filter], queryFn: () => adminApi.theories(filter === 'all' ? undefined : filter) });
  const status = useMutation({
    mutationFn: (v: { id: string; status: AdminTheory['status'] }) => adminApi.theoryStatus(v.id, v.status),
    onSuccess: (_, v) => {
      toast(
        v.status === 'confirmed'
          ? 'Doğru çıktı; sahibi 100 puan aldı'
          : v.status === 'debunked'
            ? 'Çürüdü olarak işaretlendi'
            : 'Yeniden açıldı',
        'success',
      );
      playSound('ok');
      qc.invalidateQueries({ queryKey: ['admin', 'theories'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const del = useMutation({
    mutationFn: (id: string) => adminApi.deleteTheory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'theories'] }),
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const rows = q.data ?? [];
  return (
    <Card
      title={
        <Pills
          items={[
            { key: 'open', label: 'Açık' },
            { key: 'confirmed', label: 'Doğru çıktı' },
            { key: 'debunked', label: 'Çürüdü' },
            { key: 'all', label: 'Tümü' },
          ]}
          value={filter}
          onChange={setFilter}
        />
      }
    >
      <p className="px-[18px] pb-3 text-[12.5px] text-faint">
        En çok oy alanlar üstte. Bölüm yayınlanmadan işaretleme; doğru çıkan teorinin sahibi 100 liderlik puanı alır.
      </p>
      {q.isLoading ? (
        <Rows />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !rows.length ? (
        <EmptyState icon="lightbulb" title="Teori yok" body="Bu süzgece uyan teori yok." />
      ) : (
        rows.map((t) => (
          <div key={t.id} className="flex items-start gap-3 px-[18px] py-3 shadow-[inset_0_0.5px_0_var(--color-line)]">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-faint">
                {t.showTitle ?? t.showTmdbId} · @{t.author?.username ?? '?'} · {t.voteCount} oy
              </p>
              <p className="mt-0.5 text-[14px]">{t.text}</p>
            </div>
            {t.status === 'confirmed' ? <Tag tone="up">Doğru</Tag> : t.status === 'debunked' ? <Tag tone="live">Çürüdü</Tag> : null}
            <div className="flex flex-none gap-1.5">
              {t.status !== 'confirmed' && (
                <Button
                  size="sm"
                  variant="primary"
                  icon="check"
                  busy={status.isPending}
                  onClick={() => status.mutate({ id: t.id, status: 'confirmed' })}
                >
                  Doğru
                </Button>
              )}
              {t.status !== 'debunked' && (
                <Button size="sm" icon="close" busy={status.isPending} onClick={() => status.mutate({ id: t.id, status: 'debunked' })}>
                  Çürüdü
                </Button>
              )}
              {t.status !== 'open' && (
                <Button size="sm" variant="ghost" onClick={() => status.mutate({ id: t.id, status: 'open' })}>
                  Aç
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                icon="delete"
                aria-label="Sil"
                onClick={async () => {
                  const r = await confirmAction({ title: 'Teori silinsin mi?', body: 'Oyları da silinir.', ok: 'Sil', danger: true });
                  if (r.ok) del.mutate(t.id);
                }}
              />
            </div>
          </div>
        ))
      )}
    </Card>
  );
}
