// Katalog · Günlük oyun (Dizidle): her gün herkese aynı dizi. Varsayılan olarak TMDB'nin en
// beğenilen dizilerinden otomatik seçilir; buradan bugün ve sonraki günlere elle dizi atanabilir.
// Geçmiş günler değiştirilemez (oynayanların sonucu bozulmasın).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { adminApi } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { toast } from '@/stores/ui';

const fmt = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });

export function Daily() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'daily'], queryFn: adminApi.daily });
  const [edit, setEdit] = useState<string | null>(null);
  const [tmdb, setTmdb] = useState('');
  const done = (m: string) => ({
    onSuccess: () => {
      toast(m, 'success');
      setEdit(null);
      setTmdb('');
      qc.invalidateQueries({ queryKey: ['admin', 'daily'] });
    },
    onError: (e: unknown) => toast(errorMessage(e), 'error'),
  });
  const set = useMutation({ mutationFn: (v: { day: string; id: string }) => adminApi.setDaily(v.day, v.id), ...done('Dizi atandı') });
  const auto = useMutation({ mutationFn: (day: string) => adminApi.autoDaily(day), ...done('Otomatik seçime döndü') });
  if (q.isLoading) return <Rows />;
  if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const { today, days } = q.data!;
  return (
    <Card title="Günlük oyun (Dizidle)">
      <p className="px-[18px] pb-3 text-[12.5px] text-faint">
        Her gün herkese aynı dizi. Boş bırakılan günler TMDB'nin en beğenilen dizilerinden otomatik seçilir. Elle atamak için dizinin TMDB
        kimliğini yaz (themoviedb.org adresindeki sayı, ör. Breaking Bad = 1396).
      </p>
      {days.map((d) => {
        const past = d.day < today;
        return (
          <div key={d.day} className="flex items-center gap-3 px-[18px] py-2.5 shadow-[inset_0_0.5px_0_var(--color-line)]">
            <div className="w-[92px] flex-none">
              <p className={`text-[13px] font-semibold ${d.day === today ? 'text-yellow' : ''}`}>
                {d.day === today ? 'Bugün' : fmt(d.day)}
              </p>
              <p className="text-[11.5px] text-faint">#{d.number}</p>
            </div>
            {d.posterUrl ? (
              <img src={d.posterUrl} alt="" className="h-12 w-8 flex-none rounded-[4px] object-cover" />
            ) : (
              <span className="h-12 w-8 flex-none rounded-[4px] bg-elev2" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px]">
                {d.title ?? d.key ?? '—'} {d.manual ? <Tag tone="up">Elle</Tag> : <Tag>Otomatik</Tag>}
              </p>
              <p className="text-[12px] text-faint">
                {d.plays ? `${d.plays} oynadı · ${d.wins} bildi (%${Math.round((d.wins / d.plays) * 100)})` : past ? 'Oynayan yok' : ' '}
              </p>
            </div>
            {!past &&
              (edit === d.day ? (
                <div className="flex flex-none items-center gap-1.5">
                  <input
                    autoFocus
                    inputMode="numeric"
                    value={tmdb}
                    onChange={(e) => setTmdb(e.target.value.replace(/\D/g, ''))}
                    placeholder="TMDB kimliği"
                    className="h-9 w-[120px] rounded-option bg-elev2 px-2.5 text-[13px] outline-none shadow-[inset_0_0_0_0.5px_var(--color-line2)]"
                  />
                  <Button
                    size="sm"
                    variant="primary"
                    busy={set.isPending}
                    disabled={!tmdb}
                    onClick={() => set.mutate({ day: d.day, id: tmdb })}
                  >
                    Ata
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>
                    Vazgeç
                  </Button>
                </div>
              ) : (
                <div className="flex flex-none gap-1.5">
                  <Button size="sm" onClick={() => setEdit(d.day)}>
                    Değiştir
                  </Button>
                  {d.manual && (
                    <Button size="sm" variant="ghost" busy={auto.isPending} onClick={() => auto.mutate(d.day)}>
                      Otomatiğe al
                    </Button>
                  )}
                </div>
              ))}
          </div>
        );
      })}
    </Card>
  );
}
