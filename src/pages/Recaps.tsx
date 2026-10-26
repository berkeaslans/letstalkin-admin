// Yaklaşanlar · Sezon özetleri: hayranların yazdığı "önceki sezonda neler oldu?" özetleri.
// Uygunsuz ya da sonraki sezonları anlatan (spoiler taşan) özeti sil.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState, ErrorState, Rows } from '@/components/ui/misc';
import { adminApi } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { confirmAction, toast } from '@/stores/ui';

export function Recaps() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'recaps'], queryFn: adminApi.recaps });
  const del = useMutation({
    mutationFn: (id: string) => adminApi.deleteRecap(id),
    onSuccess: () => {
      toast('Özet silindi', 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'recaps'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const rows = q.data ?? [];
  return (
    <Card title="Sezon özetleri">
      <p className="px-[18px] pb-3 text-[12.5px] text-faint">En yeniler üstte. Özet yalnız o sezonun sonuna kadarını anlatmalı.</p>
      {q.isLoading ? (
        <Rows />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !rows.length ? (
        <EmptyState icon="summarize" title="Özet yok" body="Henüz kimse sezon özeti yazmadı." />
      ) : (
        rows.map((r) => (
          <div key={r.id} className="flex items-start gap-3 px-[18px] py-3 shadow-[inset_0_0.5px_0_var(--color-line)]">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-faint">
                {r.showTitle ?? r.showTmdbId} · {r.season}. sezon · @{r.author?.username ?? '?'} · {r.voteCount} oy
              </p>
              <p className="mt-0.5 text-[14px] whitespace-pre-line">{r.text}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              icon="delete"
              aria-label="Sil"
              onClick={async () => {
                const c = await confirmAction({ title: 'Özet silinsin mi?', body: 'Oyları da silinir.', ok: 'Sil', danger: true });
                if (c.ok) del.mutate(r.id);
              }}
            />
          </div>
        ))
      )}
    </Card>
  );
}
