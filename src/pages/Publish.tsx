// Yayın: seçilen hesap adına (kurucular, resmi Let's Talkin' hesabı) gönderi,
// anket, oda ve quiz. Quiz listesi/yönetimi ve yayın hesapları da burada.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { create } from 'zustand';
import { Avatar, Tick } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, EmptyState, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { Drawer } from '@/components/ui/Overlays';
import { Switch } from '@/components/ui/Switch';
import { Pills, Segment } from '@/components/ui/Tabs';
import { adminApi, mediaUrl, type PublishAccount, type QuizDetail, type QuizStatus } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { fmt, timeAgo } from '@/lib/format';
import { playSound } from '@/lib/sound';
import { confirmAction, toast } from '@/stores/ui';
import { openUser } from './UserDrawer';

export const field =
  'h-10 w-full rounded-full bg-elev2 px-3.5 text-[13.5px] outline-none shadow-[inset_0_0_0_0.5px_var(--color-line2)] placeholder:text-faint focus:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.32)]';
const area =
  'min-h-[110px] w-full resize-y rounded-[14px] bg-elev2 px-3.5 py-2.5 text-[14px] leading-[1.45] outline-none shadow-[inset_0_0_0_0.5px_var(--color-line2)] placeholder:text-faint focus:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.32)]';

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-semibold text-sub">{label}</span>
      {children}
      {hint && <span className="text-[12px] text-faint">{hint}</span>}
    </div>
  );
}

/** datetime-local değeri → ISO (boşsa undefined). */
const toIso = (v: string) => (v ? new Date(v).toISOString() : undefined);
/** ISO → datetime-local değeri (yerel saat). */
function toLocal(iso: string | Date | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
const ACCOUNT_TYPE: Record<string, string> = { official: 'Resmi', fan: 'Fan sayfası', person: 'Kişisel' };

// ---------------- Hesap seçici ----------------
const AS_KEY = 'lt_admin_publish_as';
const usePublishAs = create<{ id: string | null; set: (id: string) => void }>((set) => ({
  id: (() => {
    try {
      return localStorage.getItem(AS_KEY);
    } catch {
      return null;
    }
  })(),
  set: (id) => {
    try {
      localStorage.setItem(AS_KEY, id);
    } catch {
      /* yalnız bu oturum */
    }
    set({ id });
  },
}));

function usePublishAccounts() {
  return useQuery({ queryKey: ['admin', 'publish', 'accounts'], queryFn: adminApi.publishAccounts });
}

/** Seçili yayın hesabı; listede değilse ilk hesaba düşer. */
function useSelectedAccount(): PublishAccount | null {
  const q = usePublishAccounts();
  const { id, set } = usePublishAs();
  const list = q.data?.accounts ?? [];
  const current = list.find((a) => a.id === id) ?? list[0] ?? null;
  useEffect(() => {
    if (current && current.id !== id) set(current.id);
  }, [current, id, set]);
  return current;
}

export function AccountPicker({ only }: { only?: string[] }) {
  const q = usePublishAccounts();
  const selected = useSelectedAccount();
  const set = usePublishAs((s) => s.set);
  if (q.isLoading) return <Rows n={1} />;
  if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const list = (q.data?.accounts ?? []).filter((a) => !only || only.includes(a.id));
  if (!list.length)
    return (
      <p className="text-[13px] text-sub">
        {only ? 'Yayın hesaplarından hiçbiri bu odanın üyesi değil.' : 'Henüz yayın hesabı yok. '}
        {!only && (
          <Link to="/yayin/hesaplar" className="font-semibold text-yellow">
            Hesap ekle
          </Link>
        )}
      </p>
    );
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Yayın hesabı">
      {list.map((a) => {
        const on = selected?.id === a.id;
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => set(a.id)}
            className={cn(
              'press flex h-11 items-center gap-2 rounded-full pr-3.5 pl-1.5 text-[13px] transition-colors',
              on
                ? 'bg-yellow/12 shadow-[inset_0_0_0_1px_var(--color-yellow)]'
                : 'bg-elev2 shadow-[inset_0_0_0_0.5px_var(--color-line2)] hover:bg-elev3',
            )}
          >
            <Avatar src={a.avatarPath} name={a.displayName ?? a.username} size={32} />
            <span className="flex flex-col items-start leading-tight">
              <span className="flex items-center gap-1 font-semibold">
                {a.displayName ?? a.username}
                <Tick tick={a.tick} size={12} />
              </span>
              <span className="text-[11.5px] text-faint">@{a.username}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------- Yeni yayın ----------------
type Kind = 'post' | 'poll' | 'room' | 'quiz';
/** Adres çubuğundaki ?tur= değeri (ör. Odalar'daki "Oda aç" → /yayin?tur=oda). */
const KIND_PARAM: Record<Kind, string> = { post: 'gonderi', poll: 'anket', room: 'oda', quiz: 'quiz' };

export function Publish() {
  const [params, setParams] = useSearchParams();
  const kind = (Object.keys(KIND_PARAM) as Kind[]).find((k) => KIND_PARAM[k] === params.get('tur')) ?? 'post';
  const as = useSelectedAccount();
  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-3.5">
        <Card title="Kim adına?" sub="Yayın bu hesabın profilinde görünür; denetim kaydına senin adınla düşer">
          <div className="px-[18px] pb-4">
            <AccountPicker />
          </div>
        </Card>
        <Card>
          <div className="px-[18px] pt-4 pb-1">
            <Segment
              value={kind}
              onChange={(k) => setParams({ tur: KIND_PARAM[k] }, { replace: true })}
              items={[
                { key: 'post', label: 'Gönderi' },
                { key: 'poll', label: 'Anket' },
                { key: 'room', label: 'Oda' },
                { key: 'quiz', label: 'Quiz' },
              ]}
            />
          </div>
          {kind === 'post' && <PostForm as={as} />}
          {kind === 'poll' && <PollForm as={as} />}
          {kind === 'room' && <RoomForm as={as} />}
          {kind === 'quiz' && <QuizCreate as={as} />}
        </Card>
      </div>
      <Card title="Nasıl çalışır?" className="lg:sticky lg:top-4">
        <ul className="flex flex-col gap-2.5 px-[18px] pb-5 text-[13px] text-sub">
          <li>Yalnız yayın hesapları listesindeki hesaplar seçilebilir. Listeyi admin yönetir.</li>
          <li>Oda ve quiz açarken takipçi eşiği aranmaz; içerik kara listesi yine uygulanır.</li>
          <li>Planlanan quiz zamanı gelince kendiliğinden başlar; istersen Quizler'den elle başlatırsın.</li>
          <li>Her yayın denetim kaydında "kim, hangi hesap adına" olarak görünür.</li>
        </ul>
      </Card>
    </div>
  );
}

function useDone(msg: string, reset: () => void) {
  const qc = useQueryClient();
  return {
    onSuccess: () => {
      toast(msg);
      playSound('ok');
      reset();
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e: unknown) => toast(errorMessage(e), 'error'),
  };
}

function Footer({ as, busy, disabled, label }: { as: PublishAccount | null; busy: boolean; disabled: boolean; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t-[0.5px] border-line px-[18px] py-3.5">
      {as && (
        <span className="flex items-center gap-1.5 text-[12.5px] text-sub">
          <Avatar src={as.avatarPath} name={as.displayName ?? as.username} size={20} />
          <b className="font-semibold text-text">@{as.username}</b> adına
        </span>
      )}
      <Button type="submit" variant="primary" className="ml-auto" busy={busy} disabled={disabled || !as}>
        {label}
      </Button>
    </div>
  );
}

function PostForm({ as }: { as: PublishAccount | null }) {
  const [text, setText] = useState('');
  const [media, setMedia] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [spoiler, setSpoiler] = useState(false);
  const [spoilerNote, setSpoilerNote] = useState('');
  const [show, setShow] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const reset = () => {
    setText('');
    setMedia([]);
    setSpoiler(false);
    setSpoilerNote('');
    setShow('');
  };
  const m = useMutation({
    mutationFn: () =>
      adminApi.publishPost({
        asUserId: as!.id,
        type: 'post',
        text: text.trim() || undefined,
        mediaPaths: media.length ? media : undefined,
        showTmdbId: show.trim() || undefined,
        isSpoiler: spoiler,
        spoilerNote: spoiler && spoilerNote.trim() ? spoilerNote.trim() : undefined,
      }),
    ...useDone('Gönderi yayınlandı', reset),
  });

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of [...files].slice(0, 4 - media.length)) {
        const { url } = await adminApi.uploadImage(f);
        setMedia((cur) => [...cur, url]);
      }
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setUploading(false);
      if (file.current) file.current.value = '';
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate();
      }}
    >
      <div className="flex flex-col gap-3.5 px-[18px] py-4">
        <textarea
          className={area}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ne paylaşmak istiyorsun?"
          maxLength={4000}
        />
        <div className="flex flex-wrap gap-2">
          {media.map((u) => (
            <div key={u} className="relative h-20 w-20 overflow-hidden rounded-[12px] bg-elev3">
              <img src={mediaUrl(u) ?? ''} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="Görseli kaldır"
                onClick={() => setMedia((cur) => cur.filter((x) => x !== u))}
                className="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-black/70"
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
          {media.length < 4 && (
            <button
              type="button"
              onClick={() => file.current?.click()}
              className="grid h-20 w-20 place-items-center rounded-[12px] bg-elev2 text-sub shadow-[inset_0_0_0_0.5px_var(--color-line2)] hover:text-text"
            >
              <Icon name={uploading ? 'progress_activity' : 'add_circle'} size={22} className={cn(uploading && 'animate-spin')} />
            </button>
          )}
          <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Dizi (TMDB ID)" hint="İsteğe bağlı; gönderi dizinin sayfasında da çıkar">
            <input className={field} value={show} onChange={(e) => setShow(e.target.value)} placeholder="ör. 1396" inputMode="numeric" />
          </Field>
          <Field label="Spoiler">
            <div className="flex h-10 items-center gap-3">
              <Switch checked={spoiler} onChange={setSpoiler} label="Spoiler içerir" />
              {spoiler && (
                <input
                  className={field}
                  value={spoilerNote}
                  onChange={(e) => setSpoilerNote(e.target.value)}
                  placeholder="ör. 5. sezon finali"
                  maxLength={200}
                />
              )}
            </div>
          </Field>
        </div>
      </div>
      <Footer as={as} busy={m.isPending} disabled={uploading || (!text.trim() && !media.length)} label="Paylaş" />
    </form>
  );
}

const POLL_HOURS = [
  { key: '24', label: '1 gün' },
  { key: '72', label: '3 gün' },
  { key: '168', label: '7 gün' },
] as const;

function PollForm({ as }: { as: PublishAccount | null }) {
  const [text, setText] = useState('');
  const [opts, setOpts] = useState(['', '']);
  const [hours, setHours] = useState<(typeof POLL_HOURS)[number]['key']>('72');
  const reset = () => {
    setText('');
    setOpts(['', '']);
  };
  const clean = opts.map((o) => o.trim()).filter(Boolean);
  const m = useMutation({
    mutationFn: () =>
      adminApi.publishPost({
        asUserId: as!.id,
        type: 'poll',
        text: text.trim(),
        pollOptions: clean,
        pollDurationHours: Number(hours),
        isSpoiler: false,
      }),
    ...useDone('Anket yayınlandı', reset),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate();
      }}
    >
      <div className="flex flex-col gap-3.5 px-[18px] py-4">
        <textarea
          className={cn(area, 'min-h-[76px]')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Soru"
          maxLength={4000}
        />
        <div className="flex flex-col gap-2">
          {opts.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className={field}
                value={o}
                onChange={(e) => setOpts((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={`${i + 1}. seçenek`}
                maxLength={80}
              />
              {opts.length > 2 && (
                <Button size="xs" variant="ghost" type="button" onClick={() => setOpts((cur) => cur.filter((_, j) => j !== i))}>
                  Kaldır
                </Button>
              )}
            </div>
          ))}
          {opts.length < 4 && (
            <Button
              size="sm"
              variant="outline"
              type="button"
              icon="add_circle"
              className="self-start"
              onClick={() => setOpts((cur) => [...cur, ''])}
            >
              Seçenek ekle
            </Button>
          )}
        </div>
        <Field label="Süre">
          <div className="w-full max-w-[320px]">
            <Segment value={hours} onChange={setHours} items={POLL_HOURS.map((h) => ({ key: h.key, label: h.label }))} />
          </div>
        </Field>
      </div>
      <Footer as={as} busy={m.isPending} disabled={!text.trim() || clean.length < 2} label="Anketi yayınla" />
    </form>
  );
}

type RoomKind = 'permanent' | 'temporary' | 'official_finale';
type Privacy = 'public' | 'requestToJoin' | 'inviteOnly';
export const PRIVACY: Record<Privacy, string> = { public: 'Herkese açık', requestToJoin: 'İstekle', inviteOnly: 'Yalnız davet' };
export const ROOM_KIND: Record<RoomKind, string> = { permanent: 'Kalıcı', temporary: 'Geçici', official_finale: 'Final odası' };

function RoomForm({ as }: { as: PublishAccount | null }) {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [kind, setKind] = useState<RoomKind>('permanent');
  const [privacy, setPrivacy] = useState<Privacy>('public');
  const [closesAt, setClosesAt] = useState('');
  const [spoilerRule, setSpoilerRule] = useState('');
  const [show, setShow] = useState('');
  const [welcome, setWelcome] = useState('');
  const reset = () => {
    setName('');
    setDesc('');
    setWelcome('');
    setSpoilerRule('');
    setClosesAt('');
  };
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () =>
      adminApi.publishRoom({
        asUserId: as!.id,
        name: name.trim(),
        description: desc.trim() || undefined,
        kind,
        privacy,
        showTmdbId: show.trim() || undefined,
        spoilerRule: spoilerRule.trim() || undefined,
        closesAt: kind === 'permanent' ? undefined : toIso(closesAt),
        welcome: welcome.trim() || undefined,
      }),
    onSuccess: () => {
      toast('Oda açıldı', 'success', 'Odalar ekranından yönetebilirsin');
      playSound('ok');
      reset();
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate();
      }}
    >
      <div className="flex flex-col gap-3.5 px-[18px] py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Oda adı">
            <input
              className={field}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ör. Breaking Bad sohbet"
              maxLength={60}
            />
          </Field>
          <Field label="Dizi (TMDB ID)" hint="İsteğe bağlı">
            <input className={field} value={show} onChange={(e) => setShow(e.target.value)} placeholder="ör. 1396" inputMode="numeric" />
          </Field>
        </div>
        <Field label="Açıklama">
          <textarea className={cn(area, 'min-h-[70px]')} value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={300} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tür">
            <Segment
              value={kind}
              onChange={setKind}
              items={(Object.keys(ROOM_KIND) as RoomKind[]).map((k) => ({ key: k, label: ROOM_KIND[k] }))}
            />
          </Field>
          <Field label="Gizlilik">
            <Segment
              value={privacy}
              onChange={setPrivacy}
              items={(Object.keys(PRIVACY) as Privacy[]).map((k) => ({ key: k, label: PRIVACY[k] }))}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {kind !== 'permanent' && (
            <Field label="Kapanış" hint="Boşsa 24 saat; en fazla 7 gün">
              <input type="datetime-local" className={field} value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
            </Field>
          )}
          <Field label="Spoiler kuralı" hint="İsteğe bağlı">
            <input
              className={field}
              value={spoilerRule}
              onChange={(e) => setSpoilerRule(e.target.value)}
              placeholder="ör. Son bölüm spoiler serbest"
              maxLength={120}
            />
          </Field>
        </div>
        <Field label="Karşılama mesajı" hint="Oda açılınca bu hesap adına ilk mesaj olarak gider">
          <input
            className={field}
            value={welcome}
            onChange={(e) => setWelcome(e.target.value)}
            placeholder="ör. Hoş geldiniz! Yayın 21:00'de"
            maxLength={1000}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t-[0.5px] border-line px-[18px] py-3.5">
        <Button type="button" variant="ghost" size="sm" onClick={() => nav('/moderasyon/odalar')}>
          Odalara git
        </Button>
        <div className="ml-auto">
          <Button type="submit" variant="primary" busy={m.isPending} disabled={!as || name.trim().length < 2}>
            Odayı aç
          </Button>
        </div>
      </div>
    </form>
  );
}

// ---------------- Quiz formu (oluştur + düzenle) ----------------
type Difficulty = 'easy' | 'medium' | 'hard';
const DIFF: Record<Difficulty, string> = { easy: 'Kolay', medium: 'Orta', hard: 'Zor' };
interface QDraft {
  text: string;
  options: string[];
  correctIndex: number;
}
export interface QuizDraft {
  title: string;
  difficulty: Difficulty;
  secondsPerQuestion: number;
  startsAt: string;
  showTmdbId: string;
  questions: QDraft[];
}
const blankQ = (): QDraft => ({ text: '', options: ['', '', '', ''], correctIndex: 0 });
const LETTERS = ['A', 'B', 'C', 'D'];

function quizValid(d: QuizDraft) {
  return (
    d.title.trim().length >= 2 && d.questions.length > 0 && d.questions.every((q) => q.text.trim() && q.options.every((o) => o.trim()))
  );
}
export function draftToBody(d: QuizDraft) {
  return {
    title: d.title.trim(),
    difficulty: d.difficulty,
    secondsPerQuestion: d.secondsPerQuestion,
    startsAt: toIso(d.startsAt),
    showTmdbId: d.showTmdbId.trim() || undefined,
    questions: d.questions.map((q) => ({ text: q.text.trim(), options: q.options.map((o) => o.trim()), correctIndex: q.correctIndex })),
  };
}

function QuizForm({
  initial,
  footer,
  onSubmit,
}: {
  initial?: QuizDraft;
  footer: (valid: boolean) => ReactNode;
  onSubmit: (d: QuizDraft, reset: () => void) => void;
}) {
  const empty: QuizDraft = { title: '', difficulty: 'medium', secondsPerQuestion: 15, startsAt: '', showTmdbId: '', questions: [blankQ()] };
  const [d, setD] = useState<QuizDraft>(initial ?? empty);
  const setQ = (i: number, patch: Partial<QDraft>) =>
    setD((cur) => ({ ...cur, questions: cur.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) }));
  const move = (i: number, by: number) =>
    setD((cur) => {
      const qs = [...cur.questions];
      const [x] = qs.splice(i, 1);
      qs.splice(i + by, 0, x);
      return { ...cur, questions: qs };
    });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(d, () => setD(empty));
      }}
    >
      <div className="flex flex-col gap-3.5 px-[18px] py-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
          <Field label="Başlık">
            <input
              className={field}
              value={d.title}
              onChange={(e) => setD({ ...d, title: e.target.value })}
              placeholder="ör. Breaking Bad ne kadar iyi biliyorsun?"
              maxLength={100}
            />
          </Field>
          <Field label="Dizi (TMDB ID)">
            <input
              className={field}
              value={d.showTmdbId}
              onChange={(e) => setD({ ...d, showTmdbId: e.target.value })}
              placeholder="İsteğe bağlı"
              inputMode="numeric"
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Zorluk">
            <Segment
              value={d.difficulty}
              onChange={(k) => setD({ ...d, difficulty: k })}
              items={(Object.keys(DIFF) as Difficulty[]).map((k) => ({ key: k, label: DIFF[k] }))}
            />
          </Field>
          <Field label="Soru başına süre">
            <select
              className={field}
              value={d.secondsPerQuestion}
              onChange={(e) => setD({ ...d, secondsPerQuestion: Number(e.target.value) })}
            >
              {[10, 15, 20, 30, 45, 60].map((s) => (
                <option key={s} value={s}>
                  {s} saniye
                </option>
              ))}
            </select>
          </Field>
          <Field label="Başlangıç" hint="Boşsa elle başlatırsın">
            <input type="datetime-local" className={field} value={d.startsAt} onChange={(e) => setD({ ...d, startsAt: e.target.value })} />
          </Field>
        </div>

        <div className="flex flex-col gap-3">
          {d.questions.map((q, i) => (
            <div key={i} className="flex flex-col gap-2.5 rounded-[14px] bg-elev2 p-3.5 shadow-[inset_0_0_0_0.5px_var(--color-line)]">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-faint">SORU {i + 1}</span>
                <div className="ml-auto flex gap-1">
                  <Button size="xs" variant="ghost" type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Yukarı">
                    ↑
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    type="button"
                    disabled={i === d.questions.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Aşağı"
                  >
                    ↓
                  </Button>
                  {d.questions.length > 1 && (
                    <Button
                      size="xs"
                      variant="ghost"
                      type="button"
                      onClick={() => setD((cur) => ({ ...cur, questions: cur.questions.filter((_, j) => j !== i) }))}
                    >
                      Sil
                    </Button>
                  )}
                </div>
              </div>
              <input
                className={field}
                value={q.text}
                onChange={(e) => setQ(i, { text: e.target.value })}
                placeholder="Soru metni"
                maxLength={200}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((o, k) => {
                  const right = q.correctIndex === k;
                  return (
                    <div key={k} className="flex items-center gap-2">
                      <button
                        type="button"
                        title="Doğru şık"
                        aria-pressed={right}
                        onClick={() => setQ(i, { correctIndex: k })}
                        className={cn(
                          'grid h-8 w-8 flex-none place-items-center rounded-full text-[12px] font-bold transition-colors',
                          right ? 'bg-up text-black' : 'bg-elev3 text-sub hover:text-text',
                        )}
                      >
                        {right ? <Icon name="check" size={16} /> : LETTERS[k]}
                      </button>
                      <input
                        className={field}
                        value={o}
                        onChange={(e) => setQ(i, { options: q.options.map((x, j) => (j === k ? e.target.value : x)) })}
                        placeholder={`${LETTERS[k]} şıkkı`}
                        maxLength={80}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {d.questions.length < 20 && (
            <Button
              size="sm"
              variant="outline"
              type="button"
              icon="add_circle"
              className="self-start"
              onClick={() => setD((cur) => ({ ...cur, questions: [...cur.questions, blankQ()] }))}
            >
              Soru ekle
            </Button>
          )}
          <p className="text-[12px] text-faint">
            {d.questions.length} soru · yaklaşık {Math.ceil((d.questions.length * (d.secondsPerQuestion + 2)) / 60)} dakika. Doğru şıkkı
            harfine tıklayarak seç.
          </p>
        </div>
      </div>
      {footer(quizValid(d))}
    </form>
  );
}

function QuizCreate({ as }: { as: PublishAccount | null }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (d: QuizDraft) => adminApi.publishQuiz({ asUserId: as!.id, ...draftToBody(d) }),
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  return (
    <QuizForm
      onSubmit={(d, reset) =>
        m.mutate(d, {
          onSuccess: ({ id }) => {
            toast('Quiz oluşturuldu', 'success', d.startsAt ? 'Zamanı gelince kendiliğinden başlar' : 'Quizler ekranından başlatabilirsin');
            playSound('ok');
            reset();
            qc.invalidateQueries({ queryKey: ['admin'] });
            useQuizDrawer.setState({ id });
            nav('/yayin/quizler');
          },
        })
      }
      footer={(valid) => <Footer as={as} busy={m.isPending} disabled={!valid} label="Quizi oluştur" />}
    />
  );
}

// ---------------- Quizler ----------------
const STATUS: Record<QuizStatus, [string, 'yellow' | 'live' | undefined]> = {
  scheduled: ['Planlı', 'yellow'],
  live: ['Canlı', 'live'],
  finished: ['Bitti', undefined],
};
const useQuizDrawer = create<{ id: string | null }>(() => ({ id: null }));

export function Quizzes() {
  const [status, setStatus] = useState<QuizStatus | 'all'>('all');
  const res = useInfiniteQuery({
    queryKey: ['admin', 'quizzes', status],
    queryFn: ({ pageParam }) => adminApi.quizzes({ status, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    refetchInterval: 10_000,
  });
  const rows = res.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center gap-2 px-[18px] py-3.5">
          <Pills
            items={[
              { key: 'all', label: 'Hepsi' },
              { key: 'live', label: 'Canlı' },
              { key: 'scheduled', label: 'Planlı' },
              { key: 'finished', label: 'Biten' },
            ]}
            value={status}
            onChange={setStatus}
          />
          <Link to="/yayin?tur=quiz" className="ml-auto">
            <Button size="sm" variant="primary" icon="add_circle">
              Yeni quiz
            </Button>
          </Link>
        </div>
        {res.isLoading ? (
          <Rows />
        ) : res.isError ? (
          <ErrorState error={res.error} retry={() => res.refetch()} />
        ) : !rows.length ? (
          <EmptyState icon="bolt" title="Quiz yok" body="Yeni yayın ekranından seçtiğin hesap adına quiz oluşturabilirsin." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr className="text-left text-[12px] text-faint">
                  <th className="px-[18px] py-2.5 font-semibold">Quiz</th>
                  <th className="px-3 py-2.5 font-semibold">Hesap</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Soru</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Katılım</th>
                  <th className="px-[18px] py-2.5 font-semibold">Durum</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const [label, tone] = STATUS[r.status];
                  return (
                    <tr
                      key={r.id}
                      className="cursor-pointer shadow-[inset_0_0.5px_0_var(--color-line)] hover:bg-white/3"
                      onClick={() => useQuizDrawer.setState({ id: r.id })}
                    >
                      <td className="px-[18px] py-2.5">
                        <p className="font-semibold">{r.title}</p>
                        <p className="text-[12px] text-faint">
                          {DIFF[r.difficulty as Difficulty] ?? r.difficulty} · {r.secondsPerQuestion} sn ·{' '}
                          {r.status === 'scheduled' && r.startsAt
                            ? `başlangıç ${new Date(r.startsAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}`
                            : timeAgo(r.createdAt)}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{r.creator ? `@${r.creator.username}` : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular">{r.questionCount}</td>
                      <td className="px-3 py-2.5 text-right tabular">{fmt(r.attemptCount)}</td>
                      <td className="px-[18px] py-2.5">
                        <Tag tone={tone}>
                          {r.status === 'live' && <span className="live-dot h-1.5 w-1.5 rounded-full bg-current" />}
                          {label}
                          {r.status === 'live' && ` · ${r.currentQuestion + 1}/${r.questionCount}`}
                        </Tag>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {res.hasNextPage && (
          <div className="flex justify-center p-4">
            <Button size="sm" variant="outline" busy={res.isFetchingNextPage} onClick={() => res.fetchNextPage()}>
              Daha fazla
            </Button>
          </div>
        )}
      </Card>
      <QuizDrawer />
    </>
  );
}

function QuizDrawer() {
  const id = useQuizDrawer((s) => s.id);
  const close = () => {
    useQuizDrawer.setState({ id: null });
    setEditing(false);
  };
  const [editing, setEditing] = useState(false);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['admin', 'quiz', id],
    queryFn: () => adminApi.quiz(id!),
    enabled: !!id,
    refetchInterval: (s) => (s.state.data?.status === 'live' ? 2_000 : false),
  });
  const done = (msg: string) => ({
    onSuccess: () => {
      toast(msg);
      playSound('ok');
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e: unknown) => toast(errorMessage(e), 'error'),
  });
  const start = useMutation({ mutationFn: () => adminApi.startQuiz(id!), ...done('Quiz başladı') });
  const end = useMutation({ mutationFn: (note?: string) => adminApi.endQuiz(id!, note), ...done('Quiz bitirildi') });
  const del = useMutation({
    mutationFn: () => adminApi.deleteQuiz(id!),
    ...done('Quiz silindi'),
    onSettled: () => useQuizDrawer.setState({ id: null }),
  });
  const edit = useMutation({
    mutationFn: (d: QuizDraft) => adminApi.editQuiz(id!, { ...draftToBody(d), startsAt: toIso(d.startsAt) ?? null }),
    ...done('Quiz güncellendi'),
  });
  const r = q.data;

  return (
    <Drawer open={!!id} title={r?.title ?? 'Quiz'} onClose={close}>
      {q.isLoading ? (
        <Rows n={6} />
      ) : q.isError ? (
        <ErrorState error={q.error} />
      ) : (
        r &&
        (editing ? (
          <QuizForm
            initial={detailToDraft(r)}
            onSubmit={(d) => edit.mutate(d, { onSuccess: () => setEditing(false) })}
            footer={(valid) => (
              <div className="flex gap-2 border-t-[0.5px] border-line px-[18px] py-3.5">
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  Vazgeç
                </Button>
                <Button type="submit" variant="primary" className="ml-auto" busy={edit.isPending} disabled={!valid}>
                  Kaydet
                </Button>
              </div>
            )}
          />
        ) : (
          <QuizView
            r={r}
            actions={
              <div className="flex flex-wrap gap-2">
                {r.status === 'scheduled' && (
                  <>
                    <Button
                      size="sm"
                      variant="primary"
                      icon="bolt"
                      busy={start.isPending}
                      onClick={async () => {
                        const c = await confirmAction({
                          title: 'Quiz şimdi başlasın mı?',
                          body: `İlk soru hemen yayınlanır; katılan ${r.attemptCount} kişiye bildirim gider.`,
                          ok: 'Başlat',
                        });
                        if (c.ok) start.mutate();
                      }}
                    >
                      Şimdi başlat
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                      Düzenle
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      busy={del.isPending}
                      onClick={async () => {
                        const c = await confirmAction({
                          title: 'Quiz silinsin mi?',
                          body: 'Başlamamış quiz ve soruları kalıcı silinir.',
                          ok: 'Sil',
                          danger: true,
                        });
                        if (c.ok) del.mutate();
                      }}
                    >
                      Sil
                    </Button>
                  </>
                )}
                {r.status === 'live' && (
                  <Button
                    size="sm"
                    variant="danger"
                    busy={end.isPending}
                    onClick={async () => {
                      const c = await confirmAction({
                        title: 'Quiz şimdi bitirilsin mi?',
                        body: 'Sıralama o anki puanlarla kesinleşir, ödüller dağıtılır.',
                        ok: 'Bitir',
                        danger: true,
                        note: 'optional',
                      });
                      if (c.ok) end.mutate(c.note);
                    }}
                  >
                    Erken bitir
                  </Button>
                )}
              </div>
            }
          />
        ))
      )}
    </Drawer>
  );
}

function detailToDraft(r: QuizDetail): QuizDraft {
  return {
    title: r.title,
    difficulty: (r.difficulty as Difficulty) ?? 'medium',
    secondsPerQuestion: r.secondsPerQuestion,
    startsAt: toLocal(r.startsAt),
    showTmdbId: r.showTmdbId ?? '',
    questions: r.questions.map((x) => ({ text: x.text, options: [...x.options], correctIndex: x.correctIndex })),
  };
}

function QuizView({ r, actions }: { r: QuizDetail; actions: ReactNode }) {
  const [label, tone] = STATUS[r.status];
  return (
    <>
      <div className="flex flex-col gap-3 px-[18px] pb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag tone={tone}>
            {r.status === 'live' && <span className="live-dot h-1.5 w-1.5 rounded-full bg-current" />}
            {label}
            {r.status === 'live' && ` · soru ${r.currentQuestion + 1}/${r.questionCount}`}
          </Tag>
          <Tag>{DIFF[r.difficulty as Difficulty] ?? r.difficulty}</Tag>
          <Tag>{r.secondsPerQuestion} sn</Tag>
          <Tag>{fmt(r.attemptCount)} katılımcı</Tag>
        </div>
        {r.creator && (
          <button
            type="button"
            onClick={() => openUser(r.creator!.id)}
            className="flex items-center gap-1.5 self-start text-[12.5px] text-sub hover:text-text"
          >
            <Avatar src={r.creator.avatarPath} name={r.creator.displayName ?? r.creator.username} size={20} />
            <b className="font-semibold text-text">@{r.creator.username}</b>
            <Tick tick={r.creator.tick} size={12} />
            <span>adına</span>
          </button>
        )}
        {r.status === 'scheduled' && (
          <p className="text-[13px] text-sub">
            {r.startsAt
              ? `${new Date(r.startsAt).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })} tarihinde kendiliğinden başlar.`
              : 'Başlangıç zamanı yok; elle başlatılır.'}
          </p>
        )}
        {actions}
      </div>

      {r.leaderboard.length > 0 && (
        <>
          <p className="px-[18px] pt-2 pb-1.5 text-[12px] font-bold text-faint">SIRALAMA</p>
          {r.leaderboard.slice(0, 10).map((l) => (
            <div key={l.rank} className="flex items-center gap-3 px-[18px] py-2 shadow-[inset_0_0.5px_0_var(--color-line)]">
              <span className={cn('w-5 text-center text-[13px] font-bold tabular', l.rank <= 3 ? 'text-yellow' : 'text-faint')}>
                {l.rank}
              </span>
              {l.user ? (
                <>
                  <Avatar src={l.user.avatarPath} name={l.user.displayName ?? l.user.username} size={24} />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">@{l.user.username}</span>
                </>
              ) : (
                <span className="flex-1 text-[13px] text-faint">silinmiş hesap</span>
              )}
              <span className="text-[13px] font-bold tabular">{fmt(l.score)}</span>
            </div>
          ))}
        </>
      )}

      <p className="px-[18px] pt-4 pb-1.5 text-[12px] font-bold text-faint">SORULAR</p>
      {r.questions.map((x) => {
        const current = r.status === 'live' && x.order === r.currentQuestion;
        return (
          <div
            key={x.order}
            className={cn('flex flex-col gap-2 px-[18px] py-3 shadow-[inset_0_0.5px_0_var(--color-line)]', current && 'bg-yellow/6')}
          >
            <div className="flex items-start gap-2">
              <span className="text-[12px] font-bold text-faint">{x.order + 1}</span>
              <p className="min-w-0 flex-1 text-[13.5px] font-semibold">{x.text}</p>
              {current && <Tag tone="live">şu an</Tag>}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {x.options.map((o, k) => (
                <span
                  key={k}
                  className={cn(
                    'truncate rounded-[10px] px-2.5 py-1.5 text-[12.5px]',
                    k === x.correctIndex ? 'bg-up/14 font-semibold text-up' : 'bg-elev2 text-sub',
                  )}
                >
                  {LETTERS[k]} · {o}
                </span>
              ))}
            </div>
            {x.answered > 0 && (
              <p className="text-[12px] text-faint">
                {fmt(x.answered)} cevap · %{Math.round((x.correct / x.answered) * 100)} doğru
              </p>
            )}
          </div>
        );
      })}
    </>
  );
}

// ---------------- Yayın hesapları ----------------
export function PublishAccounts() {
  const q = usePublishAccounts();
  const qc = useQueryClient();
  const [term, setTerm] = useState('');
  const search = useQuery({
    queryKey: ['admin', 'users', 'publish-search', term.trim()],
    queryFn: () => adminApi.users({ q: term.trim() }),
    enabled: term.trim().length >= 2,
  });
  const save = useMutation({
    mutationFn: (ids: string[]) => adminApi.setPublishAccounts(ids),
    onSuccess: () => {
      playSound('ok');
      qc.invalidateQueries({ queryKey: ['admin', 'publish'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const ids = q.data?.accounts.map((a) => a.id) ?? [];
  const add = (id: string, name: string) => save.mutate([...ids, id], { onSuccess: () => toast(`@${name} yayın hesaplarına eklendi`) });
  const remove = async (a: PublishAccount) => {
    const c = await confirmAction({
      title: `@${a.username} listeden çıksın mı?`,
      body: 'Panelden artık bu hesap adına yayın yapılamaz. Mevcut içerikleri etkilenmez.',
      ok: 'Çıkar',
    });
    if (c.ok)
      save.mutate(
        ids.filter((x) => x !== a.id),
        { onSuccess: () => toast(`@${a.username} çıkarıldı`) },
      );
  };

  const row = (
    a: {
      id: string;
      username: string;
      displayName: string | null;
      avatarPath: string | null;
      tick: 'none' | 'yellow' | 'blue';
      accountType?: string;
      followerCount?: number;
    },
    right: ReactNode,
  ) => (
    <div key={a.id} className="flex items-center gap-3 px-[18px] py-2.5 shadow-[inset_0_0.5px_0_var(--color-line)]">
      <Avatar src={a.avatarPath} name={a.displayName ?? a.username} size={34} />
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openUser(a.id)}>
        <p className="flex items-center gap-1.5 text-[13.5px] font-semibold">
          {a.displayName ?? a.username}
          <Tick tick={a.tick} size={12} />
        </p>
        <p className="text-[12px] text-faint">
          @{a.username}
          {a.accountType && ` · ${ACCOUNT_TYPE[a.accountType] ?? a.accountType}`}
          {a.followerCount != null && ` · ${fmt(a.followerCount)} takipçi`}
        </p>
      </button>
      {right}
    </div>
  );

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-2">
      <Card title="Yayın hesapları" sub="Panelden adına yayın yapılabilecek hesaplar">
        {q.isLoading ? (
          <Rows n={3} />
        ) : q.isError ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : !q.data?.accounts.length ? (
          <EmptyState
            icon="campaign"
            title="Liste boş"
            body="Kurucu hesaplarını ve resmi Let's Talkin' hesabını ekle; Yeni yayın ekranında seçilebilir olurlar."
          />
        ) : (
          q.data.accounts.map((a) =>
            row(
              a,
              <Button size="xs" variant="ghost" onClick={() => remove(a)}>
                Çıkar
              </Button>,
            ),
          )
        )}
      </Card>

      <div className="flex flex-col gap-3.5">
        {!!q.data?.suggestions.length && (
          <Card title="Öneriler" sub="Sarı tikli ve resmi hesaplar">
            {q.data.suggestions.map((a) =>
              row(
                a,
                <Button
                  size="xs"
                  variant="outline"
                  icon="add_circle"
                  busy={save.isPending && save.variables?.includes(a.id)}
                  onClick={() => add(a.id, a.username)}
                >
                  Ekle
                </Button>,
              ),
            )}
          </Card>
        )}
        <Card title="Hesap ara">
          <div className="px-[18px] pb-3">
            <input className={field} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Kullanıcı adı veya isim" />
          </div>
          {term.trim().length >= 2 &&
            (search.isLoading ? (
              <Rows n={2} />
            ) : !search.data?.items.length ? (
              <p className="px-[18px] pb-4 text-[13px] text-faint">Sonuç yok</p>
            ) : (
              search.data.items.slice(0, 8).map((u) =>
                row(
                  u,
                  ids.includes(u.id) ? (
                    <Tag>Listede</Tag>
                  ) : (
                    <Button size="xs" variant="outline" icon="add_circle" disabled={u.isBanned} onClick={() => add(u.id, u.username)}>
                      Ekle
                    </Button>
                  ),
                ),
              )
            ))}
        </Card>
      </div>
    </div>
  );
}
