// Yaklaşanlar · Tahminler: "Finalde kim ölecek?", "En iyi film?" gibi tahmin soruları.
// Kapanana dek kullanıcılar bir kez tahmin eder; sonuç açıklanınca buradan doğru seçenek
// işaretlenir, doğru bilenler o haftanın liderlik tablosunda sorunun puanını alır.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { Drawer } from '@/components/ui/Overlays';
import { type AdminPrediction, adminApi, type PredictionBody } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { playSound } from '@/lib/sound';
import { useIsAdmin } from '@/stores/session';
import { confirmAction, toast } from '@/stores/ui';
import { Field, field } from './Publish';

type Draft = { question: string; options: string[]; closesAt: string; points: number; eventId: string };
const empty: Draft = { question: '', options: ['', ''], closesAt: '', points: 50, eventId: '' };
const local = (d: string | Date) => {
  const x = new Date(d);
  return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fmt = (d: string | Date) =>
  new Date(d).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function Predictions() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'predictions'], queryFn: adminApi.predictions });
  const events = useQuery({ queryKey: ['admin', 'events', 'next'], queryFn: () => adminApi.events(false) });
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft; locked: boolean } | null>(null);
  const refresh = (msg: string) => {
    toast(msg, 'success');
    playSound('ok');
    qc.invalidateQueries({ queryKey: ['admin', 'predictions'] });
  };
  const save = useMutation({
    mutationFn: (e: { id: string | null; draft: Draft }) => {
      const b: PredictionBody = {
        question: e.draft.question.trim(),
        options: e.draft.options.map((o) => o.trim()).filter(Boolean),
        closesAt: new Date(e.draft.closesAt).toISOString(),
        points: e.draft.points,
        eventId: e.draft.eventId || null,
      };
      return e.id ? adminApi.savePrediction(e.id, b).then(() => ({ id: e.id as string })) : adminApi.createPrediction(b);
    },
    onSuccess: (_, e) => {
      refresh(e.id ? 'Tahmin güncellendi' : 'Tahmin eklendi');
      setEditing(null);
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });
  const resolve = useMutation({
    mutationFn: (v: { id: string; index: number | null }) => adminApi.resolvePrediction(v.id, v.index),
    onSuccess: (_, v) => refresh(v.index === null ? 'Sonuç geri alındı' : 'Sonuçlandı; doğru bilenler puan aldı'),
    onError: (err) => toast(errorMessage(err), 'error'),
  });
  const del = useMutation({
    mutationFn: (id: string) => adminApi.deletePrediction(id),
    onSuccess: () => {
      refresh('Tahmin silindi');
      setEditing(null);
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });
  const rows = q.data ?? [];
  return (
    <>
      <Card
        title="Tahminler"
        right={
          isAdmin && (
            <Button size="sm" variant="primary" icon="add" onClick={() => setEditing({ id: null, draft: empty, locked: false })}>
              Tahmin ekle
            </Button>
          )
        }
      >
        <p className="px-[18px] pb-3 text-[12.5px] text-faint">
          Kullanıcılar kapanana dek bir kez tahmin eder; oranları tahmin ettikten sonra görür. Sonuç açıklanınca doğru seçeneğe tıkla.
        </p>
        {q.isLoading ? (
          <Rows />
        ) : q.isError ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : !rows.length ? (
          <EmptyState icon="how_to_vote" title="Tahmin yok" body="Yaklaşan bir ödül töreni ya da final için soru ekle." />
        ) : (
          rows.map((p) => (
            <PredictionRow
              key={p.id}
              p={p}
              isAdmin={isAdmin}
              busy={resolve.isPending}
              onResolve={(index) => resolve.mutate({ id: p.id, index })}
              onEdit={() =>
                setEditing({
                  id: p.id,
                  locked: p.voteCount > 0,
                  draft: {
                    question: p.question,
                    options: p.options,
                    closesAt: local(p.closesAt),
                    points: p.points,
                    eventId: p.eventId ?? '',
                  },
                })
              }
            />
          ))
        )}
      </Card>
      {editing && (
        <PredictionDrawer
          key={editing.id ?? 'yeni'}
          initial={editing.draft}
          isNew={!editing.id}
          lockedOptions={editing.locked}
          events={(events.data ?? []).map((e) => ({ id: e.id, title: e.title }))}
          busy={save.isPending || del.isPending}
          onClose={() => setEditing(null)}
          onSave={(draft) => save.mutate({ id: editing.id, draft })}
          onDelete={async () => {
            const r = await confirmAction({ title: 'Tahmin silinsin mi?', body: 'Verilen tahminler de silinir.', ok: 'Sil', danger: true });
            if (r.ok && editing.id) del.mutate(editing.id);
          }}
        />
      )}
    </>
  );
}

function PredictionRow({
  p,
  isAdmin,
  busy,
  onResolve,
  onEdit,
}: {
  p: AdminPrediction;
  isAdmin: boolean;
  busy: boolean;
  onResolve: (i: number | null) => void;
  onEdit: () => void;
}) {
  const total = p.counts.reduce((a, b) => a + b, 0);
  return (
    <div className="px-[18px] py-3.5 shadow-[inset_0_0.5px_0_var(--color-line)]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold">{p.question}</p>
          <p className="mt-0.5 text-[12px] text-faint">
            {p.closed ? 'Kapandı' : `Kapanış ${fmt(p.closesAt)}`} · {p.voteCount} tahmin · doğruya {p.points} puan
          </p>
        </div>
        {p.resolvedIndex !== null ? (
          <Tag tone="up">Sonuçlandı</Tag>
        ) : p.closed ? (
          <Tag tone="yellow">Sonuç bekliyor</Tag>
        ) : (
          <Tag tone="blue">Açık</Tag>
        )}
        {isAdmin && (
          <Button size="sm" variant="ghost" icon="edit" onClick={onEdit}>
            Düzenle
          </Button>
        )}
      </div>
      <div className="mt-2.5 grid gap-1.5">
        {p.options.map((o, i) => {
          const pct = total ? Math.round((p.counts[i]! / total) * 100) : 0;
          const right = p.resolvedIndex === i;
          return (
            <button
              key={o}
              type="button"
              disabled={!isAdmin || busy}
              title={isAdmin ? (right ? 'Sonucu geri al' : 'Doğru cevap olarak işaretle') : undefined}
              onClick={async () => {
                const r = await confirmAction(
                  right
                    ? { title: 'Sonuç geri alınsın mı?', body: 'Verilen puanlar liderlik tablosundan düşer.', ok: 'Geri al' }
                    : {
                        title: `"${o}" doğru cevap mı?`,
                        body: `Bu seçeneği bilen ${p.counts[i]} kişi ${p.points} puan alır.`,
                        ok: 'Sonuçlandır',
                      },
                );
                if (r.ok) onResolve(right ? null : i);
              }}
              className={cn(
                'relative flex h-9 items-center overflow-hidden rounded-[10px] bg-elev2 px-3 text-left text-[13px] font-medium',
                isAdmin && 'hover:bg-elev3',
              )}
            >
              <span className={cn('absolute inset-y-0 left-0', right ? 'bg-up/30' : 'bg-white/8')} style={{ width: `${pct}%` }} />
              <span className="relative flex-1 truncate">
                {right && '✓ '}
                {o}
              </span>
              <span className="relative text-[12px] text-sub tabular">
                {p.counts[i]} · %{pct}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PredictionDrawer({
  initial,
  isNew,
  lockedOptions,
  events,
  busy,
  onClose,
  onSave,
  onDelete,
}: {
  initial: Draft;
  isNew: boolean;
  lockedOptions: boolean;
  events: { id: string; title: string }[];
  busy: boolean;
  onClose: () => void;
  onSave: (d: Draft) => void;
  onDelete: () => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((cur) => ({ ...cur, [k]: v }));
  const opts = d.options.map((o) => o.trim()).filter(Boolean);
  const valid = d.question.trim().length >= 5 && opts.length >= 2 && new Set(opts).size === opts.length && !!d.closesAt;
  return (
    <Drawer
      open
      title={isNew ? 'Yeni tahmin' : 'Tahmini düzenle'}
      onClose={onClose}
      footer={
        <div className="flex w-full items-center gap-2">
          {!isNew && (
            <Button size="sm" variant="danger" icon="delete" onClick={onDelete} disabled={busy}>
              Sil
            </Button>
          )}
          <span className="flex-1" />
          <Button size="sm" variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button size="sm" variant="primary" busy={busy} disabled={!valid} onClick={() => onSave(d)}>
            {isNew ? 'Ekle' : 'Kaydet'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 px-[18px] py-4">
        <Field label="Soru">
          <input
            className={field}
            value={d.question}
            maxLength={200}
            onChange={(e) => set('question', e.target.value)}
            placeholder="ör. Oscar'da en iyi film hangisi olacak?"
          />
        </Field>
        <Field label="Seçenekler" hint={lockedOptions ? 'Tahmin verildiği için seçenekler değiştirilemez' : '2–10 seçenek'}>
          <div className="flex flex-col gap-2">
            {d.options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={field}
                  value={o}
                  maxLength={80}
                  disabled={lockedOptions}
                  onChange={(e) =>
                    set(
                      'options',
                      d.options.map((x, j) => (j === i ? e.target.value : x)),
                    )
                  }
                  placeholder={`Seçenek ${i + 1}`}
                />
                {!lockedOptions && d.options.length > 2 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="close"
                    onClick={() =>
                      set(
                        'options',
                        d.options.filter((_, j) => j !== i),
                      )
                    }
                    aria-label="Seçeneği kaldır"
                  />
                )}
              </div>
            ))}
            {!lockedOptions && d.options.length < 10 && (
              <Button size="sm" variant="ghost" icon="add" onClick={() => set('options', [...d.options, ''])}>
                Seçenek ekle
              </Button>
            )}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kapanış" hint="Bu andan sonra tahmin alınmaz">
            <input type="datetime-local" className={field} value={d.closesAt} onChange={(e) => set('closesAt', e.target.value)} />
          </Field>
          <Field label="Puan" hint="Doğru bilene liderlik puanı">
            <input
              type="number"
              min={5}
              max={500}
              className={field}
              value={d.points}
              onChange={(e) => set('points', Number(e.target.value) || 50)}
            />
          </Field>
        </div>
        <Field label="Etkinlik (isteğe bağlı)" hint="Seçilirse uygulamada etkinliğin sayfasında da görünür">
          <select className={field} value={d.eventId} onChange={(e) => set('eventId', e.target.value)}>
            <option value="">Etkinliğe bağlı değil</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Drawer>
  );
}
