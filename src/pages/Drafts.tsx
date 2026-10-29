// Yayın · İçerik taslakları: tohum içerik betiği ve otomatik editörün ürettiği gönderi, anket ve
// quizler. Hiçbiri kendiliğinden yayınlanmaz; buradan okunup onaylanır ya da reddedilir.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { Segment } from '@/components/ui/Tabs';
import { adminApi, type Draft } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { toast } from '@/stores/ui';
import { field } from './Publish';

const EVENT: Record<string, string> = { new_season: 'Yeni sezon', trailer: 'Fragman', anniversary: 'Yıl dönümü' };
const KIND: Record<Draft['kind'], string> = { post: 'Gönderi', poll: 'Anket', quiz: 'Quiz' };

export function Drafts() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Draft['status']>('draft');
  const [source, setSource] = useState<'all' | 'seed' | 'auto'>('all');
  const q = useQuery({
    queryKey: ['admin', 'drafts', status, source],
    queryFn: () => adminApi.drafts(status, source === 'all' ? undefined : source),
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
      </div>
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
        {'questions' in p ? (
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
