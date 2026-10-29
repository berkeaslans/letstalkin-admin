// Yayın · İçerik taslakları: tohum içerik betiği ve otomatik editörün ürettiği gönderi, anket ve
// quizler. Hiçbiri kendiliğinden yayınlanmaz; buradan okunup onaylanır ya da reddedilir.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { Segment } from '@/components/ui/Tabs';
import { adminApi, type Draft, type PersonalityPayload } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { toast } from '@/stores/ui';
import { field } from './Publish';

const EVENT: Record<string, string> = { new_season: 'Yeni sezon', trailer: 'Fragman', anniversary: 'Yıl dönümü' };
const KIND: Record<Draft['kind'], string> = { post: 'Gönderi', poll: 'Anket', quiz: 'Quiz', personality: 'Kişilik testi' };

export function Drafts() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Draft['status']>('draft');
  const [source, setSource] = useState<'all' | 'seed' | 'auto'>('all');
  const [kind, setKind] = useState<'all' | Draft['kind']>('all');
  const q = useQuery({
    queryKey: ['admin', 'drafts', status, source, kind],
    queryFn: () => adminApi.drafts(status, source === 'all' ? undefined : source, kind === 'all' ? undefined : kind),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'drafts'] });
  const publish = useMutation({
    mutationFn: (id: string) => adminApi.publishDraft(id),
    onSuccess: () => {
      toast('Yayınlandı');
      refresh();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const reject = useMutation({ mutationFn: (id: string) => adminApi.rejectDraft(id), onSuccess: refresh });
  // Hatalı parti: o çalıştırmanın bekleyen bütün taslakları reddedilir (iki adımlı onay).
  const [confirmRun, setConfirmRun] = useState<string | null>(null);
  const rollback = useMutation({
    mutationFn: (run: string) => adminApi.rollbackDrafts(run),
    onSuccess: (r) => {
      toast(`Parti geri alındı: ${r.rejected} taslak reddedildi`);
      setConfirmRun(null);
      refresh();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const runs = [...new Set((q.data?.items ?? []).filter((d) => d.status === 'draft' && d.seedRunId).map((d) => d.seedRunId as string))];

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Segment
          items={[
            { key: 'draft', label: 'Bekleyen' },
            { key: 'published', label: 'Yayınlanan' },
            { key: 'rejected', label: 'Reddedilen' },
          ]}
          value={status}
          onChange={(k) => setStatus(k as Draft['status'])}
        />
        <Segment
          items={[
            { key: 'all', label: 'Hepsi' },
            { key: 'seed', label: 'Tohum içerik' },
            { key: 'auto', label: 'Otomatik editör' },
          ]}
          value={source}
          onChange={(k) => setSource(k as 'all' | 'seed' | 'auto')}
        />
        <Segment
          items={[
            { key: 'all', label: 'Tüm türler' },
            { key: 'quiz', label: 'Quiz' },
            { key: 'poll', label: 'Anket' },
            { key: 'post', label: 'Gönderi' },
            { key: 'personality', label: 'Test' },
          ]}
          value={kind}
          onChange={(k) => setKind(k as 'all' | Draft['kind'])}
        />
      </div>
      {status === 'draft' && runs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-sub">
          <span>Partiyi geri al:</span>
          {runs.map((run) =>
            confirmRun === run ? (
              <span key={run} className="flex items-center gap-1.5">
                <span className="text-text">Parti {run} reddedilsin mi?</span>
                <Button size="sm" variant="danger" busy={rollback.isPending} onClick={() => rollback.mutate(run)}>
                  Evet, geri al
                </Button>
                <Button size="sm" onClick={() => setConfirmRun(null)}>
                  Vazgeç
                </Button>
              </span>
            ) : (
              <Button key={run} size="sm" variant="outline" onClick={() => setConfirmRun(run)}>
                {run}
              </Button>
            ),
          )}
        </div>
      )}
      {!q.data ? (
        <Card>{q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : <Rows n={6} />}</Card>
      ) : !q.data.items.length ? (
        <Card>
          <p className="px-[18px] py-5 text-[13px] text-faint">Bu listede taslak yok.</p>
        </Card>
      ) : (
        q.data.items.map((d) => (
          <DraftCard
            key={d.id}
            d={d}
            busy={(publish.isPending && publish.variables === d.id) || (reject.isPending && reject.variables === d.id)}
            onPublish={() => publish.mutate(d.id)}
            onReject={() => reject.mutate(d.id)}
            onSaved={refresh}
          />
        ))
      )}
    </>
  );
}

function DraftCard({
  d,
  busy,
  onPublish,
  onReject,
  onSaved,
}: {
  d: Draft;
  busy: boolean;
  onPublish: () => void;
  onReject: () => void;
  onSaved: () => void;
}) {
  const p = d.payload;
  const [text, setText] = useState('text' in p ? p.text : '');
  const save = useMutation({
    mutationFn: () => adminApi.editDraft(d.id, { ...(p as { text: string; options?: string[] }), text }),
    onSuccess: () => {
      toast('Kaydedildi');
      onSaved();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  return (
    <Card
      title={`${d.showTitle ?? d.showTmdbId ?? '—'} · ${KIND[d.kind]}`}
      sub={[
        d.source === 'seed' ? 'tohum' : (EVENT[d.eventType ?? ''] ?? 'otomatik'),
        d.lang.toUpperCase(),
        d.account ? `@${d.account}` : 'resmi hesap',
        d.seedRunId ? `parti ${d.seedRunId}` : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      right={
        d.status === 'draft' ? (
          <>
            <Button size="sm" onClick={onReject} disabled={busy}>
              Reddet
            </Button>
            <Button size="sm" variant="primary" onClick={onPublish} busy={busy}>
              Yayınla
            </Button>
          </>
        ) : (
          <Tag tone={d.status === 'published' ? 'up' : undefined}>{d.status === 'published' ? 'yayınlandı' : 'reddedildi'}</Tag>
        )
      }
    >
      <div className="px-[18px] pb-4">
        {'results' in p ? (
          <PersonalityEditor d={d} p={p} onSaved={onSaved} />
        ) : 'questions' in p ? (
          <>
            <p className="text-[14px] font-semibold">{p.title}</p>
            <ol className="mt-2 space-y-2">
              {p.questions.map((qq, i) => (
                <li key={`${qq.text}-${i}`} className="text-[13px]">
                  <span className="font-semibold">
                    {i + 1}. {qq.text}
                  </span>
                  <span className="block text-sub">
                    {qq.options.map((o, j) => (
                      <span key={o} className={j === qq.correctIndex ? 'font-semibold text-up' : undefined}>
                        {j ? ' · ' : ''}
                        {o}
                      </span>
                    ))}
                  </span>
                  {qq.sourceFact && <span className="block text-[11.5px] text-faint">Kaynak: {qq.sourceFact}</span>}
                </li>
              ))}
            </ol>
          </>
        ) : d.status === 'draft' ? (
          <>
            <textarea className={`${field} min-h-[72px] w-full`} value={text} onChange={(e) => setText(e.target.value)} />
            {p.options && <p className="mt-1.5 text-[12.5px] text-sub">Şıklar: {p.options.join(' · ')}</p>}
            {text !== p.text && (
              <Button size="sm" className="mt-2" busy={save.isPending} onClick={() => save.mutate()}>
                Metni kaydet
              </Button>
            )}
          </>
        ) : (
          <p className="text-[13.5px] whitespace-pre-wrap">{p.text}</p>
        )}
      </div>
    </Card>
  );
}

/**
 * Kişilik testi taslağı: başlık, sonuç açıklamaları, soru ve şık metinleri düzenlenir. Karakterler,
 * oyuncular ve puanlar tohum betiğinden gelir (TMDB paketi) ve burada değiştirilmez; her şıkkın
 * hangi karaktere puan verdiği yanında görünür.
 */
function PersonalityEditor({ d, p, onSaved }: { d: Draft; p: PersonalityPayload; onSaved: () => void }) {
  const [draft, setDraft] = useState<PersonalityPayload>(p);
  const editable = d.status === 'draft';
  const dirty = JSON.stringify(draft) !== JSON.stringify(p);
  const name = new Map(p.results.map((r) => [r.key, r.character]));
  const save = useMutation({
    mutationFn: () => adminApi.editDraft(d.id, draft),
    onSuccess: () => {
      toast('Kaydedildi');
      onSaved();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const setResult = (i: number, description: string) =>
    setDraft((x) => ({ ...x, results: x.results.map((r, j) => (j === i ? { ...r, description } : r)) }));
  const setQuestion = (i: number, text: string) =>
    setDraft((x) => ({ ...x, questions: x.questions.map((q, j) => (j === i ? { ...q, text } : q)) }));
  const setOption = (i: number, k: number, text: string) =>
    setDraft((x) => ({
      ...x,
      questions: x.questions.map((q, j) => (j === i ? { ...q, options: q.options.map((o, m) => (m === k ? { ...o, text } : o)) } : q)),
    }));
  const input = `${field} w-full`;
  return (
    <div className="flex flex-col gap-4">
      {editable ? (
        <input className={`${input} font-semibold`} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      ) : (
        <p className="text-[14px] font-semibold">{draft.title}</p>
      )}
      <div>
        <p className="mb-2 text-[11.5px] font-semibold tracking-[0.06em] text-faint uppercase">Sonuçlar</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {draft.results.map((r, i) => (
            <div key={r.key} className="flex gap-2.5 rounded-[12px] bg-elev2 p-2.5">
              {r.imagePath ? (
                <img
                  src={`https://image.tmdb.org/t/p/w92${r.imagePath}`}
                  alt=""
                  className="h-[58px] w-[42px] flex-none rounded-[8px] object-cover"
                />
              ) : (
                <div className="h-[58px] w-[42px] flex-none rounded-[8px] bg-elev" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">
                  {r.character}
                  {r.actor && <span className="font-normal text-faint"> · {r.actor}</span>}
                </p>
                {editable ? (
                  <textarea
                    className={`${input} mt-1 min-h-[52px] text-[12.5px]`}
                    value={r.description}
                    onChange={(e) => setResult(i, e.target.value)}
                  />
                ) : (
                  <p className="mt-0.5 text-[12.5px] text-sub">{r.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[11.5px] font-semibold tracking-[0.06em] text-faint uppercase">Sorular</p>
        <ol className="flex flex-col gap-3">
          {draft.questions.map((q, i) => (
            <li key={i} className="text-[13px]">
              {editable ? (
                <input className={`${input} font-semibold`} value={q.text} onChange={(e) => setQuestion(i, e.target.value)} />
              ) : (
                <span className="font-semibold">
                  {i + 1}. {q.text}
                </span>
              )}
              <div className="mt-1.5 flex flex-col gap-1.5 pl-3">
                {q.options.map((o, k) => (
                  <div key={k} className="flex items-center gap-2">
                    {editable ? (
                      <input className={`${input} h-8 text-[12.5px]`} value={o.text} onChange={(e) => setOption(i, k, e.target.value)} />
                    ) : (
                      <span className="text-sub">{o.text}</span>
                    )}
                    <span className="flex-none text-[11.5px] text-faint">
                      {Object.entries(o.points)
                        .map(([key, v]) => `${name.get(key) ?? key} +${v}`)
                        .join(' · ')}
                    </span>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </div>
      {editable && dirty && (
        <div className="flex gap-2">
          <Button size="sm" variant="primary" busy={save.isPending} onClick={() => save.mutate()}>
            Testi kaydet
          </Button>
          <Button size="sm" onClick={() => setDraft(p)}>
            Geri al
          </Button>
        </div>
      )}
    </div>
  );
}
