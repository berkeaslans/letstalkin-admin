// Katalog · yapım düzenleme. İki iş, tek form:
//  - TMDB yapımı: doldurulan alan TMDB'nin üstüne yazılır, boş bırakılan TMDB'den gelir
//    (her alanın altında TMDB'deki değer görünür). TMDB senkronu düzenlemeyi ezmez.
//  - Elle eklenen yapım (TMDB'de yok; ör. amatör bir YouTube dizisi): bütün bilgi buradan,
//    dizide sezon ve bölümler dahil. Site ve uygulama onu TMDB yapımı gibi gösterir.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { Segment } from '@/components/ui/Tabs';
import { adminApi, type TitleData, type TitleEdit, type TitleKind } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/format';
import { go, paths } from '@/lib/go';
import { playSound } from '@/lib/sound';
import { useIsAdmin } from '@/stores/session';
import { confirmAction, toast } from '@/stores/ui';
import { area, Field, field } from './Publish';

const SITE = (import.meta.env.VITE_SITE_URL ?? 'https://letstalkin.com').replace(/\/$/, '');

const LANGS = {
  tr: 'Türkçe',
  en: 'İngilizce',
  es: 'İspanyolca',
  pt: 'Portekizce',
  de: 'Almanca',
  fr: 'Fransızca',
  it: 'İtalyanca',
  ru: 'Rusça',
  ar: 'Arapça',
  hi: 'Hintçe',
  id: 'Endonezce',
  zh: 'Çince',
  ja: 'Japonca',
  ko: 'Korece',
  pl: 'Lehçe',
  el: 'Yunanca',
} as const;
type Lang = keyof typeof LANGS;

const STATUS: Record<string, string> = {
  'Returning Series': 'Devam ediyor',
  'In Production': 'Yapım aşamasında',
  Planned: 'Planlandı',
  Ended: 'Bitti',
  Canceled: 'İptal edildi',
  Released: 'Yayınlandı',
};
type Status = NonNullable<TitleData['status']>;

type Text = { title: string; overview: string; tagline: string };
type Ep = { number: number; name: string; airDate: string; videoUrl: string; overview: string };
type Season = { number: number; name: string; episodes: Ep[] };
type Draft = {
  text: Partial<Record<Lang, Text>>;
  originalTitle: string;
  posterUrl: string;
  backdropUrl: string;
  releaseDate: string;
  endYear: string;
  status: string;
  genreIds: number[];
  runtime: string;
  trailer: string;
  networks: string;
  creators: string;
  cast: Array<{ name: string; character: string }>;
  watchUrl: string;
  watchLabel: string;
  seasons: Season[];
};

const emptyText: Text = { title: '', overview: '', tagline: '' };
const list = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
const opt = (s: string) => s.trim() || undefined;
/** Bağlantı adı boşsa adresten: youtube.com → "YouTube", diğerleri alan adı. */
function hostLabel(url: string) {
  if (/(^|\.)youtu(\.be|be\.com)/i.test(url.replace(/^https?:\/\//, '').split('/')[0] ?? '')) return 'YouTube';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'İzle';
  }
}

function fromData(d: TitleData): Draft {
  const text: Draft['text'] = {};
  for (const [l, t] of Object.entries(d.text ?? {}))
    text[l as Lang] = { title: t?.title ?? '', overview: t?.overview ?? '', tagline: t?.tagline ?? '' };
  return {
    text,
    originalTitle: d.originalTitle ?? '',
    posterUrl: d.posterUrl ?? '',
    backdropUrl: d.backdropUrl ?? '',
    releaseDate: d.releaseDate ?? '',
    endYear: d.endYear ?? '',
    status: d.status ?? '',
    genreIds: d.genreIds ?? [],
    runtime: d.runtime ? String(d.runtime) : '',
    trailer: d.trailer ? `https://www.youtube.com/watch?v=${d.trailer}` : '',
    networks: (d.networks ?? []).join(', '),
    creators: (d.creators ?? []).join(', '),
    cast: (d.cast ?? []).map((c) => ({ name: c.name, character: c.character ?? '' })),
    watchUrl: d.watch?.url ?? '',
    watchLabel: d.watch?.label ?? '',
    seasons: (d.seasons ?? []).map((s) => ({
      number: s.number,
      name: s.name ?? '',
      episodes: s.episodes.map((e) => ({
        number: e.number,
        name: e.name ?? '',
        airDate: e.airDate ?? '',
        videoUrl: e.videoUrl ?? '',
        overview: e.overview ?? '',
      })),
    })),
  };
}

function toData(d: Draft): TitleData {
  const text: NonNullable<TitleData['text']> = {};
  for (const [l, t] of Object.entries(d.text)) {
    if (!t) continue;
    const v = { title: opt(t.title), overview: opt(t.overview), tagline: opt(t.tagline) };
    if (v.title || v.overview || v.tagline) text[l as Lang] = v;
  }
  return {
    text,
    originalTitle: opt(d.originalTitle),
    posterUrl: opt(d.posterUrl),
    backdropUrl: opt(d.backdropUrl),
    releaseDate: opt(d.releaseDate),
    endYear: opt(d.endYear),
    status: (opt(d.status) as Status | undefined) ?? undefined,
    genreIds: d.genreIds,
    runtime: Number(d.runtime) > 0 ? Math.round(Number(d.runtime)) : undefined,
    trailer: opt(d.trailer),
    networks: list(d.networks),
    creators: list(d.creators),
    cast: d.cast.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), character: opt(c.character) })),
    watch: d.watchUrl.trim() ? { url: d.watchUrl.trim(), label: d.watchLabel.trim() || hostLabel(d.watchUrl.trim()) } : undefined,
    seasons: d.seasons.length
      ? d.seasons.map((s) => ({
          number: s.number,
          name: opt(s.name),
          episodes: s.episodes.map((e) => ({
            number: e.number,
            name: opt(e.name),
            airDate: opt(e.airDate),
            videoUrl: opt(e.videoUrl),
            overview: opt(e.overview),
          })),
        }))
      : undefined,
  };
}

/** Yeni yapım: /katalog/yeni */
export function NewTitle() {
  return <TitleForm edit={null} />;
}

/** Var olan yapım: /katalog/:tmdbId/duzenle */
export function EditTitle() {
  const { tmdbId } = useParams<{ tmdbId: string }>();
  const q = useQuery({ queryKey: ['admin', 'title-edit', tmdbId], queryFn: () => adminApi.titleEdit(tmdbId!), enabled: !!tmdbId });
  if (!q.data) return <Card>{q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : <Rows n={8} />}</Card>;
  return <TitleForm key={q.data.key + String(q.data.updatedAt)} edit={q.data} />;
}

function TitleForm({ edit }: { edit: TitleEdit | null }) {
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const creating = !edit;
  const custom = creating || edit.custom;
  const base = edit?.base ?? null;
  const [kind, setKind] = useState<TitleKind>(edit?.kind ?? 'tv');
  const initial = useMemo(() => fromData(edit?.data ?? {}), [edit]);
  const [d, setD] = useState<Draft>(initial);
  const [lang, setLang] = useState<Lang>('tr');
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((cur) => ({ ...cur, [k]: v }));
  const text = d.text[lang] ?? emptyText;
  const setText = (k: keyof Text, v: string) =>
    setD((cur) => ({ ...cur, text: { ...cur.text, [lang]: { ...(cur.text[lang] ?? emptyText), [k]: v } } }));
  const dirty = creating ? JSON.stringify(d) !== JSON.stringify(fromData({})) : JSON.stringify(d) !== JSON.stringify(initial);
  const genres = useQuery({ queryKey: ['admin', 'genres', kind], queryFn: () => adminApi.genres(kind), staleTime: 3600_000 });

  // Sayfadan kaydedilmemiş değişiklikle çıkılırken uyar.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'shows'] });
    qc.invalidateQueries({ queryKey: ['admin', 'title-edit'] });
  };
  const save = useMutation({
    mutationFn: async () => {
      const data = toData(d);
      if (creating) return (await adminApi.createTitle(kind, data)).key;
      await adminApi.saveTitle(edit.key, data);
      return edit.key;
    },
    onSuccess: (key) => {
      toast(creating ? 'Yapım eklendi' : 'Değişiklikler yayında', 'success', 'Site ve uygulama bir dakika içinde yeni bilgiyi gösterir');
      playSound('ok');
      refresh();
      if (creating) go(paths.titleEdit(key));
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const drop = useMutation({
    mutationFn: () => adminApi.dropTitleEdit(edit!.key),
    onSuccess: () => {
      toast(custom ? 'Yapım silindi' : "Düzenlemeler geri alındı · TMDB'deki bilgi geçerli");
      playSound('ok');
      refresh();
      go(custom ? '/katalog' : paths.show(edit!.key));
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  async function confirmDrop() {
    const r = await confirmAction(
      custom
        ? {
            title: 'Yapım silinsin mi?',
            body: 'Sitedeki ve uygulamadaki sayfası kalkar. Hakkındaki gönderiler silinmez.',
            ok: 'Sil',
            danger: true,
          }
        : { title: 'Düzenlemeler geri alınsın mı?', body: "Bütün alanlar TMDB'deki bilgiye döner.", ok: 'Geri al', danger: true },
    );
    if (r.ok) drop.mutate();
  }

  const id = edit?.key.replace(/^m:/, '');
  const title = text.title || d.text.tr?.title || base?.title || 'Yeni yapım';
  const poster = d.posterUrl || base?.posterUrl || null;
  const filledLangs = (Object.keys(LANGS) as Lang[]).filter((l) => l === 'tr' || d.text[l]);
  const readOnly = !isAdmin;

  return (
    <form
      className="flex flex-col gap-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!readOnly) save.mutate();
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" icon="arrow_back" onClick={() => go(edit ? paths.show(edit.key) : '/katalog')}>
          {edit ? 'Yapım karnesi' : 'Yapımlar'}
        </Button>
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {custom ? <Tag tone="yellow">Elle eklenen</Tag> : <Tag>TMDB {id}</Tag>}
          {edit?.updatedAt && <span className="text-[12px] text-faint">son düzenleme {timeAgo(edit.updatedAt)}</span>}
          {edit && (
            <a
              href={`${SITE}/${edit.kind === 'tv' ? 'dizi' : 'film'}/${id}`}
              target="_blank"
              rel="noreferrer"
              className="press flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-sub hover:bg-elev2 hover:text-text"
            >
              <Icon name="open_in_new" size={16} />
              Sitede gör
            </a>
          )}
        </span>
      </div>

      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-3.5">
          {!custom && (
            <p className="flex items-start gap-2 rounded-card bg-elev px-[18px] py-3 text-[13px] leading-relaxed text-sub shadow-[inset_0_0_0_0.5px_var(--color-line)]">
              <Icon name="info" size={18} className="mt-0.5 flex-none text-faint" />
              Doldurduğun alan TMDB'deki bilginin yerine geçer; boş bıraktığın alan TMDB'den gelmeye devam eder. TMDB'nin düzenli
              güncellemesi yaptığın değişikliği silmez.
            </p>
          )}

          <Card title="Ad ve konu">
            <div className="flex flex-col gap-4 px-[18px] pb-5">
              {creating && (
                <Field label="Tür">
                  <Segment
                    items={[
                      { key: 'tv', label: 'Dizi' },
                      { key: 'movie', label: 'Film' },
                    ]}
                    value={kind}
                    onChange={(k) => {
                      setKind(k);
                      if (k === 'movie') set('seasons', []);
                      set('genreIds', []);
                    }}
                  />
                </Field>
              )}
              <LangBar value={lang} filled={filledLangs} onChange={setLang} onAdd={(l) => setLang(l)} />
              <Field
                label="Ad"
                hint={
                  !custom && base ? (
                    <Was v={lang === 'tr' ? base.title : null} />
                  ) : custom && lang !== 'tr' ? (
                    'Boş bırakılırsa Türkçe ad kullanılır'
                  ) : undefined
                }
              >
                <input
                  className={field}
                  value={text.title}
                  maxLength={200}
                  onChange={(e) => setText('title', e.target.value)}
                  placeholder={
                    !custom && lang === 'tr' ? base?.title : custom && lang === 'tr' ? 'ör. Mahalle Hikâyeleri' : d.text.tr?.title
                  }
                  readOnly={readOnly}
                />
              </Field>
              <Field label="Konu" hint={!custom && base && lang === 'tr' ? 'Boş bırakılırsa TMDB konusu görünür' : undefined}>
                <textarea
                  className={area}
                  value={text.overview}
                  maxLength={5000}
                  onChange={(e) => setText('overview', e.target.value)}
                  placeholder={!custom && lang === 'tr' ? base?.overview || "TMDB'de konu yok" : 'Yapımı iki üç cümleyle anlat'}
                  readOnly={readOnly}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Slogan">
                  <input
                    className={field}
                    value={text.tagline}
                    maxLength={300}
                    onChange={(e) => setText('tagline', e.target.value)}
                    placeholder={(!custom && lang === 'tr' && base?.tagline) || 'İsteğe bağlı'}
                    readOnly={readOnly}
                  />
                </Field>
                <Field label="Özgün adı" hint="Yapımın kendi dilindeki adı">
                  <input
                    className={field}
                    value={d.originalTitle}
                    maxLength={200}
                    onChange={(e) => set('originalTitle', e.target.value)}
                    placeholder={base?.originalTitle ?? 'İsteğe bağlı'}
                    readOnly={readOnly}
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card title="Görseller" sub="Afiş dikey (2:3), arka plan yatay (16:9) olmalı">
            <div className="grid gap-4 px-[18px] pb-5 sm:grid-cols-[150px_minmax(0,1fr)]">
              <ImageField
                label="Afiş"
                shape="poster"
                value={d.posterUrl}
                base={base?.posterUrl ?? null}
                onChange={(v) => set('posterUrl', v)}
                readOnly={readOnly}
              />
              <ImageField
                label="Arka plan"
                shape="backdrop"
                value={d.backdropUrl}
                base={base?.backdropUrl ?? null}
                onChange={(v) => set('backdropUrl', v)}
                readOnly={readOnly}
              />
            </div>
          </Card>

          <Card title="Künye">
            <div className="flex flex-col gap-4 px-[18px] pb-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={kind === 'tv' ? 'İlk yayın tarihi' : 'Vizyon tarihi'} hint={base?.year ? <Was v={base.year} /> : undefined}>
                  <input
                    type="date"
                    className={field}
                    value={d.releaseDate}
                    onChange={(e) => set('releaseDate', e.target.value)}
                    readOnly={readOnly}
                  />
                </Field>
                <Field label="Durum" hint={base?.status ? <Was v={STATUS[base.status] ?? base.status} /> : undefined}>
                  <select className={field} value={d.status} onChange={(e) => set('status', e.target.value)} disabled={readOnly}>
                    <option value="">{custom ? 'Seç' : "TMDB'deki"}</option>
                    {Object.entries(STATUS)
                      .filter(([k]) => (kind === 'tv' ? k !== 'Released' : !['Returning Series', 'Ended', 'Canceled'].includes(k)))
                      .map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                  </select>
                </Field>
                {kind === 'tv' ? (
                  <Field label="Bitiş yılı" hint={base?.endYear ? <Was v={base.endYear} /> : 'Bittiyse'}>
                    <input
                      className={field}
                      value={d.endYear}
                      inputMode="numeric"
                      maxLength={4}
                      onChange={(e) => set('endYear', e.target.value.replace(/\D/g, ''))}
                      placeholder="ör. 2026"
                      readOnly={readOnly}
                    />
                  </Field>
                ) : (
                  <Field label="Süre (dakika)" hint={base?.runtime ? <Was v={`${base.runtime} dk`} /> : undefined}>
                    <input
                      className={field}
                      value={d.runtime}
                      inputMode="numeric"
                      onChange={(e) => set('runtime', e.target.value.replace(/\D/g, ''))}
                      readOnly={readOnly}
                    />
                  </Field>
                )}
              </div>
              {kind === 'tv' && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Bölüm süresi (dakika)" hint={base?.runtime ? <Was v={`${base.runtime} dk`} /> : undefined}>
                    <input
                      className={field}
                      value={d.runtime}
                      inputMode="numeric"
                      onChange={(e) => set('runtime', e.target.value.replace(/\D/g, ''))}
                      readOnly={readOnly}
                    />
                  </Field>
                </div>
              )}
              <Field
                label="Türler"
                hint={
                  !custom && base?.genreIds.length && !d.genreIds.length
                    ? `TMDB'deki: ${base.genreIds.map((g) => genres.data?.find((x) => x.id === g)?.name ?? g).join(', ')}`
                    : 'En fazla 8'
                }
              >
                <div className="flex flex-wrap gap-1.5">
                  {(genres.data ?? []).map((g) => {
                    const on = d.genreIds.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        disabled={readOnly || (!on && d.genreIds.length >= 8)}
                        onClick={() => set('genreIds', on ? d.genreIds.filter((x) => x !== g.id) : [...d.genreIds, g.id])}
                        aria-pressed={on}
                        className={cn(
                          'press h-8 rounded-full px-3 text-[12.5px] font-semibold transition-colors disabled:opacity-40',
                          on ? 'bg-text text-black' : 'bg-elev2 text-sub shadow-[inset_0_0_0_0.5px_var(--color-line2)] hover:text-text',
                        )}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                  {genres.isLoading && <span className="text-[12.5px] text-faint">Türler yükleniyor…</span>}
                  {genres.isError && <span className="text-[12.5px] text-faint">Tür listesi alınamadı (TMDB'ye ulaşılamıyor)</span>}
                </div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={kind === 'tv' ? 'Yaratıcı' : 'Yönetmen'}
                  hint={base?.creators.length ? <Was v={base.creators.join(', ')} /> : 'Virgülle ayır'}
                >
                  <input
                    className={field}
                    value={d.creators}
                    onChange={(e) => set('creators', e.target.value)}
                    placeholder="ör. Ayşe Yılmaz"
                    readOnly={readOnly}
                  />
                </Field>
                <Field
                  label={kind === 'tv' ? 'Kanal / platform' : 'Yapım / dağıtım'}
                  hint={base?.networks.length ? <Was v={base.networks.join(', ')} /> : 'Virgülle ayır'}
                >
                  <input
                    className={field}
                    value={d.networks}
                    onChange={(e) => set('networks', e.target.value)}
                    placeholder="ör. YouTube"
                    readOnly={readOnly}
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card title="Fragman ve izleme">
            <div className="flex flex-col gap-4 px-[18px] pb-5">
              <Field
                label="Fragman"
                hint={base?.trailer ? <Was v={base.trailer} /> : 'YouTube adresi; sayfada "Fragman" düğmesiyle açılır'}
              >
                <input
                  className={field}
                  value={d.trailer}
                  onChange={(e) => set('trailer', e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  readOnly={readOnly}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
                <Field label="Nerede izlenir" hint='"Nerede izlenir" bölümünde bağlantı olarak görünür (ör. YouTube oynatma listesi)'>
                  <input
                    className={field}
                    value={d.watchUrl}
                    onChange={(e) => set('watchUrl', e.target.value)}
                    placeholder="https://…"
                    readOnly={readOnly}
                  />
                </Field>
                <Field label="Bağlantı adı">
                  <input
                    className={field}
                    value={d.watchLabel}
                    maxLength={40}
                    onChange={(e) => set('watchLabel', e.target.value)}
                    placeholder="YouTube"
                    readOnly={readOnly}
                  />
                </Field>
              </div>
            </div>
          </Card>

          <CastCard cast={d.cast} base={base?.cast ?? null} onChange={(v) => set('cast', v)} readOnly={readOnly} />

          {custom && kind === 'tv' && <SeasonsCard seasons={d.seasons} onChange={(v) => set('seasons', v)} readOnly={readOnly} />}
          {!custom && kind === 'tv' && (
            <p className="px-1 text-[12.5px] text-faint">
              Sezon ve bölüm bilgisi TMDB'den gelir ({base?.seasonsCount ?? 0} sezon). Bölüm düzenleme yalnız elle eklenen dizilerde var.
            </p>
          )}
        </div>

        <aside className="flex flex-col gap-3.5 lg:sticky lg:top-4">
          <Card>
            <div className="flex gap-3 p-[18px]">
              <span className="grid h-[120px] w-[80px] flex-none place-items-center overflow-hidden rounded-[10px] bg-elev3">
                {poster ? (
                  <img src={poster} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Icon name="movie" size={24} className="text-faint" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-[15px] leading-snug font-bold break-words">{title}</p>
                <p className="mt-1 text-[12.5px] text-sub">
                  {[kind === 'tv' ? 'Dizi' : 'Film', (d.releaseDate || base?.year || '').slice(0, 4), d.status ? STATUS[d.status] : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {kind === 'tv' && custom && (
                  <p className="mt-1 text-[12.5px] text-sub">
                    {d.seasons.filter((s) => s.number > 0).length} sezon · {d.seasons.reduce((n, s) => n + s.episodes.length, 0)} bölüm
                  </p>
                )}
              </div>
            </div>
          </Card>
          {custom && (
            <p className="px-1 text-[12px] leading-relaxed text-faint">
              Sitede konusu ve afişi olan yapım arama motorlarına açılır. Diğer dillerde ad ve konu yazmazsan Türkçesi gösterilir.
            </p>
          )}
        </aside>
      </div>

      {!readOnly && (
        <div className="sticky bottom-3 z-30 rounded-card bg-elev2/90 shadow-[0_12px_40px_rgb(0_0_0/0.55),inset_0_0_0_0.5px_var(--color-line2)] backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            {edit && (
              <Button
                variant="danger"
                size="sm"
                icon={custom ? 'delete' : 'undo'}
                busy={drop.isPending}
                onClick={confirmDrop}
                disabled={!custom && !edit.updatedAt}
              >
                {custom ? 'Yapımı sil' : 'Düzenlemeleri geri al'}
              </Button>
            )}
            <span className="ml-auto text-[12.5px] text-faint">
              {dirty ? 'Kaydedilmemiş değişiklik var' : creating ? '' : 'Kaydedildi'}
            </span>
            {dirty && (
              <Button variant="ghost" size="sm" onClick={() => setD(initial)}>
                Vazgeç
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              busy={save.isPending}
              disabled={!dirty || (creating && !d.text.tr?.title.trim() && !Object.values(d.text).some((t) => t?.title.trim()))}
            >
              {creating ? 'Yapımı ekle' : 'Kaydet'}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

/** TMDB'deki değer (düzenlenen alanın altında). */
function Was({ v }: { v: string | null | undefined }) {
  if (!v) return null;
  return (
    <span className="line-clamp-1">
      TMDB'deki: <span className="text-sub">{v}</span>
    </span>
  );
}

function LangBar({
  value,
  filled,
  onChange,
  onAdd,
}: {
  value: Lang;
  filled: Lang[];
  onChange: (l: Lang) => void;
  onAdd: (l: Lang) => void;
}) {
  const rest = (Object.keys(LANGS) as Lang[]).filter((l) => !filled.includes(l) && l !== value);
  const shown = filled.includes(value) ? filled : [...filled, value];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[12.5px] font-semibold text-sub">Dil</span>
      {shown.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          aria-pressed={value === l}
          className={cn(
            'press h-8 rounded-full px-3 text-[12.5px] font-semibold',
            value === l ? 'bg-text text-black' : 'bg-elev2 text-sub shadow-[inset_0_0_0_0.5px_var(--color-line2)] hover:text-text',
          )}
        >
          {LANGS[l]}
        </button>
      ))}
      {rest.length > 0 && (
        <select
          className="h-8 rounded-full bg-transparent px-2 text-[12.5px] font-semibold text-sub outline-none hover:text-text"
          value=""
          onChange={(e) => e.target.value && onAdd(e.target.value as Lang)}
          aria-label="Dil ekle"
        >
          <option value="">+ Dil ekle</option>
          {rest.map((l) => (
            <option key={l} value={l}>
              {LANGS[l]}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function ImageField({
  label,
  shape,
  value,
  base,
  onChange,
  readOnly,
}: {
  label: string;
  shape: 'poster' | 'backdrop';
  value: string;
  base: string | null;
  onChange: (v: string) => void;
  readOnly: boolean;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const shown = value || base;
  async function upload(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      onChange((await adminApi.uploadImage(f, 'catalog')).url);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
      if (file.current) file.current.value = '';
    }
  }
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-[12.5px] font-semibold text-sub">{label}</span>
      <span
        className={cn(
          'relative grid place-items-center overflow-hidden rounded-[12px] bg-elev3',
          shape === 'poster' ? 'aspect-[2/3] w-[150px]' : 'aspect-video w-full max-w-[360px]',
        )}
      >
        {shown ? (
          <img src={shown} alt="" className={cn('h-full w-full object-cover', !value && 'opacity-60')} />
        ) : (
          <Icon name="image" size={26} className="text-faint" />
        )}
        {!value && base && (
          <span className="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold">TMDB</span>
        )}
      </span>
      {!readOnly && (
        <div className="flex flex-wrap gap-1.5">
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void upload(e.target.files?.[0])} />
          <Button size="xs" variant="outline" icon="upload" busy={busy} onClick={() => file.current?.click()}>
            Yükle
          </Button>
          {value && (
            <Button size="xs" variant="ghost" onClick={() => onChange('')}>
              {base ? "TMDB'ye dön" : 'Kaldır'}
            </Button>
          )}
        </div>
      )}
      <input
        className={cn(field, 'h-8 text-[12px]')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ya da görsel adresi"
        readOnly={readOnly}
      />
    </div>
  );
}

function CastCard({
  cast,
  base,
  onChange,
  readOnly,
}: {
  cast: Draft['cast'];
  base: Array<{ name: string; character: string | null }> | null;
  onChange: (v: Draft['cast']) => void;
  readOnly: boolean;
}) {
  const patch = (i: number, k: 'name' | 'character', v: string) => onChange(cast.map((c, j) => (j === i ? { ...c, [k]: v } : c)));
  return (
    <Card
      title="Oyuncular"
      sub={base && !cast.length ? `TMDB'den ${base.length} oyuncu geliyor; eklersen listenin tamamı seninki olur` : undefined}
      right={
        !readOnly && (
          <Button
            size="xs"
            variant="outline"
            icon="add"
            disabled={cast.length >= 40}
            onClick={() => onChange([...cast, { name: '', character: '' }])}
          >
            Oyuncu ekle
          </Button>
        )
      }
    >
      {cast.length > 0 && (
        <div className="flex flex-col gap-2 px-[18px] pb-5">
          {cast.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className={field}
                value={c.name}
                maxLength={80}
                onChange={(e) => patch(i, 'name', e.target.value)}
                placeholder="Oyuncu adı"
                readOnly={readOnly}
                aria-label="Oyuncu adı"
              />
              <input
                className={field}
                value={c.character}
                maxLength={120}
                onChange={(e) => patch(i, 'character', e.target.value)}
                placeholder="Karakter"
                readOnly={readOnly}
                aria-label="Karakter"
              />
              {!readOnly && (
                <Button
                  size="xs"
                  variant="ghost"
                  icon="close"
                  aria-label="Oyuncuyu çıkar"
                  onClick={() => onChange(cast.filter((_, j) => j !== i))}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function SeasonsCard({ seasons, onChange, readOnly }: { seasons: Season[]; onChange: (v: Season[]) => void; readOnly: boolean }) {
  const [open, setOpen] = useState<number | null>(seasons[0]?.number ?? null);
  const nextSeason = seasons.reduce((n, s) => Math.max(n, s.number), 0) + 1;
  const patchSeason = (n: number, p: Partial<Season>) => onChange(seasons.map((s) => (s.number === n ? { ...s, ...p } : s)));
  return (
    <Card
      title="Sezonlar ve bölümler"
      sub="Bölüm adresi YouTube videosuysa sayfada kapağı ve izleme bağlantısı otomatik görünür"
      right={
        !readOnly && (
          <Button
            size="xs"
            variant="outline"
            icon="add"
            disabled={seasons.length >= 100}
            onClick={() => {
              onChange([
                ...seasons,
                { number: nextSeason, name: '', episodes: [{ number: 1, name: '', airDate: '', videoUrl: '', overview: '' }] },
              ]);
              setOpen(nextSeason);
            }}
          >
            Sezon ekle
          </Button>
        )
      }
    >
      {!seasons.length ? (
        <p className="px-[18px] pb-5 text-[13px] text-faint">Henüz sezon yok. Dizinin bölümlerini eklemek için bir sezon ekle.</p>
      ) : (
        [...seasons]
          .sort((a, b) => a.number - b.number)
          .map((s) => (
            <div key={s.number} className="shadow-[inset_0_0.5px_0_var(--color-line)]">
              <button
                type="button"
                onClick={() => setOpen(open === s.number ? null : s.number)}
                aria-expanded={open === s.number}
                className="flex w-full items-center gap-2 px-[18px] py-3 text-left hover:bg-white/3"
              >
                <span className="text-[14px] font-semibold">{s.name || `${s.number}. Sezon`}</span>
                <span className="text-[12.5px] text-faint">{s.episodes.length} bölüm</span>
                <Icon
                  name="expand_more"
                  size={20}
                  className={cn('ml-auto text-faint transition-transform', open === s.number && 'rotate-180')}
                />
              </button>
              {open === s.number && (
                <SeasonEditor
                  season={s}
                  readOnly={readOnly}
                  onChange={(p) => patchSeason(s.number, p)}
                  onRemove={async () => {
                    const r = await confirmAction({
                      title: `${s.number}. sezon kaldırılsın mı?`,
                      body: 'Bölümleriyle birlikte. Kaydedince yayından kalkar.',
                      ok: 'Kaldır',
                      danger: true,
                    });
                    if (r.ok) onChange(seasons.filter((x) => x.number !== s.number));
                  }}
                />
              )}
            </div>
          ))
      )}
    </Card>
  );
}

function SeasonEditor({
  season,
  onChange,
  onRemove,
  readOnly,
}: {
  season: Season;
  onChange: (p: Partial<Season>) => void;
  onRemove: () => void;
  readOnly: boolean;
}) {
  const [more, setMore] = useState<number | null>(null);
  const eps = [...season.episodes].sort((a, b) => a.number - b.number);
  const next = eps.reduce((n, e) => Math.max(n, e.number), 0) + 1;
  const patch = (n: number, p: Partial<Ep>) => onChange({ episodes: season.episodes.map((e) => (e.number === n ? { ...e, ...p } : e)) });
  return (
    <div className="flex flex-col gap-3 px-[18px] pb-5">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <Field label="Sezon adı">
            <input
              className={field}
              value={season.name}
              maxLength={120}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder={`${season.number}. Sezon`}
              readOnly={readOnly}
            />
          </Field>
        </div>
        {!readOnly && (
          <Button size="sm" variant="ghost" icon="delete" onClick={onRemove}>
            Sezonu kaldır
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {eps.map((e) => (
          <div key={e.number} className="rounded-[14px] bg-elev2/60 p-2 shadow-[inset_0_0_0_0.5px_var(--color-line)]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-8 flex-none text-center text-[13px] font-bold text-faint tabular">{e.number}</span>
              <input
                className={cn(field, 'min-w-[160px] flex-[2]')}
                value={e.name}
                maxLength={200}
                onChange={(x) => patch(e.number, { name: x.target.value })}
                placeholder={`${e.number}. Bölüm`}
                aria-label={`${e.number}. bölümün adı`}
                readOnly={readOnly}
              />
              <input
                type="date"
                className={cn(field, 'w-[150px] flex-none')}
                value={e.airDate}
                onChange={(x) => patch(e.number, { airDate: x.target.value })}
                aria-label={`${e.number}. bölümün yayın tarihi`}
                readOnly={readOnly}
              />
              <input
                className={cn(field, 'min-w-[180px] flex-[2]')}
                value={e.videoUrl}
                onChange={(x) => patch(e.number, { videoUrl: x.target.value })}
                placeholder="Video adresi (YouTube)"
                aria-label={`${e.number}. bölümün video adresi`}
                readOnly={readOnly}
              />
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setMore(more === e.number ? null : e.number)}
                aria-expanded={more === e.number}
              >
                {e.overview ? 'Konu ✓' : 'Konu'}
              </Button>
              {!readOnly && (
                <Button
                  size="xs"
                  variant="ghost"
                  icon="close"
                  aria-label={`${e.number}. bölümü çıkar`}
                  onClick={() => onChange({ episodes: season.episodes.filter((x) => x.number !== e.number) })}
                />
              )}
            </div>
            {more === e.number && (
              <textarea
                className={cn(area, 'mt-2 min-h-[80px]')}
                value={e.overview}
                maxLength={3000}
                onChange={(x) => patch(e.number, { overview: x.target.value })}
                placeholder="Bu bölümde ne oluyor? (spoiler vermeden)"
                readOnly={readOnly}
              />
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <div>
          <Button
            size="sm"
            variant="outline"
            icon="add"
            disabled={season.episodes.length >= 500}
            onClick={() =>
              onChange({ episodes: [...season.episodes, { number: next, name: '', airDate: '', videoUrl: '', overview: '' }] })
            }
          >
            Bölüm ekle
          </Button>
        </div>
      )}
    </div>
  );
}
