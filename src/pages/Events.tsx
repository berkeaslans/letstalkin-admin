// Katalog · Etkinlikler: Yaklaşanlar bölümündeki festivaller, ödül törenleri ve topluluk film
// geceleri. Vizyon/platform takvimi TMDB'den kendiliğinden gelir; bunlar elle girilir.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, EmptyState, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { Drawer } from '@/components/ui/Overlays';
import { Switch } from '@/components/ui/Switch';
import { Pills, Segment } from '@/components/ui/Tabs';
import { adminApi, type CinemaEvent, type CinemaEventBody } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { playSound } from '@/lib/sound';
import { useIsAdmin } from '@/stores/session';
import { confirmAction, toast } from '@/stores/ui';
import { area, Field, field } from './Publish';

const KIND: Record<string, string> = { festival: 'Festival', award: 'Ödül töreni', community: 'Film gecesi' };

/** Süzgeçte en sık gerekenler; listede yoksa iki harfli kod da yazılabilir. */
const COUNTRIES: Record<string, string> = {
  TR: 'Türkiye',
  US: 'ABD',
  GB: 'Birleşik Krallık',
  FR: 'Fransa',
  DE: 'Almanya',
  IT: 'İtalya',
  ES: 'İspanya',
  NL: 'Hollanda',
  EE: 'Estonya',
  CZ: 'Çekya',
  KR: 'Güney Kore',
  JP: 'Japonya',
  CA: 'Kanada',
  CH: 'İsviçre',
  SA: 'Suudi Arabistan',
  AE: 'BAE',
};

const dayOf = (d: string | Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const fmtRange = (a: string | Date, b?: string | Date | null) => {
  const f = (d: string | Date) => new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  return b && dayOf(b) !== dayOf(a) ? `${f(a)} – ${f(b)}` : f(a);
};

type Draft = {
  kind: 'festival' | 'award' | 'community';
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  country: string;
  city: string;
  venue: string;
  url: string;
  imageUrl: string;
  showKeys: string;
  published: boolean;
};

const empty: Draft = {
  kind: 'festival',
  title: '',
  description: '',
  startsAt: '',
  endsAt: '',
  country: 'TR',
  city: '',
  venue: '',
  url: '',
  imageUrl: '',
  showKeys: '',
  published: true,
};

const fromEvent = (e: CinemaEvent): Draft => ({
  kind: (e.kind as Draft['kind']) ?? 'festival',
  title: e.title,
  description: e.description ?? '',
  startsAt: dayOf(e.startsAt),
  endsAt: dayOf(e.endsAt),
  country: e.country ?? '',
  city: e.city ?? '',
  venue: e.venue ?? '',
  url: e.url ?? '',
  imageUrl: e.imageUrl ?? '',
  showKeys: e.showKeys.join(', '),
  published: e.published,
});

const toBody = (d: Draft): CinemaEventBody => ({
  kind: d.kind,
  title: d.title.trim(),
  description: d.description.trim() || null,
  startsAt: d.startsAt,
  endsAt: d.endsAt || null,
  country: d.country.trim().toUpperCase() || null,
  city: d.city.trim() || null,
  venue: d.venue.trim() || null,
  url: d.url.trim() || null,
  imageUrl: d.imageUrl.trim() || null,
  showKeys: d.showKeys
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean),
  published: d.published,
});

export function Events() {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const [past, setPast] = useState<'next' | 'past'>('next');
  const q = useQuery({ queryKey: ['admin', 'events', past], queryFn: () => adminApi.events(past === 'past') });
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  // Tür ve ülke süzgeci (liste istemcide süzülür; sayılar süzgeç düğmelerinde).
  const [kind, setKind] = useState<'all' | Draft['kind']>('all');
  const [country, setCountry] = useState('');
  const done = (msg: string) => {
    toast(msg, 'success', 'Yaklaşanlar bölümünde hemen görünür');
    playSound('ok');
    qc.invalidateQueries({ queryKey: ['admin', 'events'] });
  };
  const save = useMutation({
    mutationFn: async (e: { id: string | null; draft: Draft }) =>
      e.id ? adminApi.saveEvent(e.id, toBody(e.draft)) : adminApi.createEvent(toBody(e.draft)),
    onSuccess: (_, e) => {
      done(e.id ? 'Etkinlik güncellendi' : 'Etkinlik eklendi');
      setEditing(null);
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });
  const del = useMutation({
    mutationFn: (id: string) => adminApi.deleteEvent(id),
    onSuccess: () => {
      done('Etkinlik silindi');
      setEditing(null);
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const all = q.data ?? [];
  const byCountry = country ? all.filter((e) => (country === '-' ? !e.country : e.country === country)) : all;
  const rows = kind === 'all' ? byCountry : byCountry.filter((e) => e.kind === kind);
  const count = (k: string) => byCountry.filter((e) => k === 'all' || e.kind === k).length;
  const countries = [...new Set(all.map((e) => e.country).filter((c): c is string => !!c))].sort();
  return (
    <>
      <Card
        right={
          isAdmin && (
            <Button size="sm" variant="primary" icon="add" onClick={() => setEditing({ id: null, draft: empty })}>
              Etkinlik ekle
            </Button>
          )
        }
        title={
          <Pills
            items={[
              { key: 'next', label: 'Yaklaşan ve süren' },
              { key: 'past', label: 'Geçmiş' },
            ]}
            value={past}
            onChange={setPast}
          />
        }
      >
        <div className="flex flex-wrap items-center gap-2 px-[18px] pb-3">
          <Pills
            items={[
              { key: 'all', label: 'Tümü', count: count('all') },
              { key: 'festival', label: 'Festival', count: count('festival') },
              { key: 'award', label: 'Ödül töreni', count: count('award') },
              { key: 'community', label: 'Film gecesi', count: count('community') },
            ]}
            value={kind}
            onChange={setKind}
          />
          <select
            className={cn(field, 'ml-auto w-auto min-w-[170px]')}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            aria-label="Ülke"
          >
            <option value="">Tüm ülkeler</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {COUNTRIES[c] ?? c}
              </option>
            ))}
            <option value="-">Çevrimiçi / ülkesiz</option>
          </select>
        </div>
        <p className="px-[18px] pb-3 text-[12.5px] text-faint">
          Vizyon ve platform takvimi TMDB'den kendiliğinden gelir. Festival, ödül töreni ve film gecelerini buradan ekle; tarih resmî olarak
          açıklanmadan ekleme.
        </p>
        {q.isLoading ? (
          <Rows />
        ) : q.isError ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : !rows.length ? (
          <EmptyState
            icon="theaters"
            title="Etkinlik yok"
            body={
              all.length
                ? 'Bu süzgece uyan etkinlik yok.'
                : past === 'past'
                  ? 'Geçmiş etkinlik yok.'
                  : 'Yaklaşan bir festival ya da tören ekle.'
            }
          />
        ) : (
          rows.map((e) => (
            <button
              type="button"
              key={e.id}
              onClick={() => isAdmin && setEditing({ id: e.id, draft: fromEvent(e) })}
              className="flex w-full items-center gap-3 px-[18px] py-3 text-left shadow-[inset_0_0.5px_0_var(--color-line)] hover:bg-white/3"
            >
              <span className="w-[150px] flex-none text-[12.5px] text-sub tabular">{fmtRange(e.startsAt, e.endsAt)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{e.title}</span>
                <span className="block truncate text-[12px] text-faint">
                  {[e.city, e.country ? (COUNTRIES[e.country] ?? e.country) : null, e.venue].filter(Boolean).join(', ') || 'Çevrimiçi'}
                </span>
              </span>
              <Tag tone={e.kind === 'festival' ? 'yellow' : e.kind === 'award' ? 'epic' : 'blue'}>{KIND[e.kind] ?? e.kind}</Tag>
              {!e.published && <Tag>Taslak</Tag>}
            </button>
          ))
        )}
      </Card>

      {editing && (
        <EventDrawer
          key={editing.id ?? 'yeni'}
          initial={editing.draft}
          isNew={!editing.id}
          busy={save.isPending || del.isPending}
          onClose={() => setEditing(null)}
          onSave={(draft) => save.mutate({ id: editing.id, draft })}
          onDelete={async () => {
            const r = await confirmAction({
              title: 'Etkinlik silinsin mi?',
              body: 'Kurulan hatırlatmalar da kaldırılır.',
              ok: 'Sil',
              danger: true,
            });
            if (r.ok && editing.id) del.mutate(editing.id);
          }}
        />
      )}
    </>
  );
}

function EventDrawer({
  initial,
  isNew,
  busy,
  onClose,
  onSave,
  onDelete,
}: {
  initial: Draft;
  isNew: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (d: Draft) => void;
  onDelete: () => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((cur) => ({ ...cur, [k]: v }));
  const file = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const valid = d.title.trim().length >= 2 && !!d.startsAt && (!d.endsAt || d.endsAt >= d.startsAt);
  return (
    <Drawer
      open
      title={isNew ? 'Yeni etkinlik' : 'Etkinliği düzenle'}
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
        <Field label="Tür">
          <Segment
            items={[
              { key: 'festival', label: 'Festival' },
              { key: 'award', label: 'Ödül töreni' },
              { key: 'community', label: 'Film gecesi' },
            ]}
            value={d.kind}
            onChange={(k) => set('kind', k)}
          />
        </Field>
        <Field label="Ad">
          <input
            className={field}
            value={d.title}
            maxLength={160}
            onChange={(e) => set('title', e.target.value)}
            placeholder="ör. 46. İstanbul Film Festivali"
          />
        </Field>
        <Field label="Kısa açıklama">
          <textarea className={area} value={d.description} maxLength={2000} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Başlangıç">
            <input type="date" className={field} value={d.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
          </Field>
          <Field label="Bitiş" hint="Tek günlükse boş bırak">
            <input type="date" className={field} value={d.endsAt} min={d.startsAt} onChange={(e) => set('endsAt', e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ülke" hint="Film gecesi çevrimiçiyse boş bırak">
            <select className={field} value={d.country} onChange={(e) => set('country', e.target.value)}>
              <option value="">Çevrimiçi / yok</option>
              {Object.entries(COUNTRIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Şehir">
            <input className={field} value={d.city} maxLength={80} onChange={(e) => set('city', e.target.value)} />
          </Field>
        </div>
        <Field label="Mekân">
          <input
            className={field}
            value={d.venue}
            maxLength={120}
            onChange={(e) => set('venue', e.target.value)}
            placeholder="ör. Atlas 1948 Sineması"
          />
        </Field>
        <Field label="Resmî site">
          <input className={field} value={d.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Görsel" hint="Yatay görsel (16:9) iyi durur">
          <div className="flex gap-2">
            <input className={field} value={d.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} placeholder="https://…" />
            <input
              ref={file}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setUploading(true);
                try {
                  set('imageUrl', (await adminApi.uploadImage(f, 'events')).url);
                } catch (err) {
                  toast(errorMessage(err), 'error');
                } finally {
                  setUploading(false);
                }
              }}
            />
            <Button size="sm" variant="outline" icon="upload" busy={uploading} onClick={() => file.current?.click()}>
              Yükle
            </Button>
          </div>
        </Field>
        <Field label="İlgili yapımlar" hint="Yapım anahtarları, virgülle: dizi 1396, film m:27205 (yapım karnesindeki numara)">
          <input className={field} value={d.showKeys} onChange={(e) => set('showKeys', e.target.value)} placeholder="1396, m:27205" />
        </Field>
        <div className="flex items-center justify-between gap-3 rounded-[14px] bg-elev2 px-3.5 py-3">
          <span className="flex items-center gap-2 text-[13.5px] font-semibold">
            <Icon name="visibility" size={18} />
            Yayında
          </span>
          <Switch checked={d.published} label="Yayında" onChange={(v) => set('published', v)} />
        </div>
      </div>
    </Drawer>
  );
}
