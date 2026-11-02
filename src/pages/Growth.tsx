// Büyüme: tanıtım ekibinin çalışma alanı. Kim hangi alanda (Twitter, kampüs, kulüpler…), kime
// hangi görev verildi, her gün ne yapıldı, kişi/kampanya bağlantıları ve bunların sonucu.
// Alan, üye ve görevleri admin girer; üye kendi görevinin durumunu, günlüğünü ve bağlantısını yönetir.
// Büyüme rolündeki hesap panelde yalnız bu bölümü görür.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button, IconButton } from '@/components/ui/Button';
import { DailyBars, Delta } from '@/components/ui/Chart';
import { Icon } from '@/components/ui/Icon';
import { Card, EmptyState, ErrorState, Rows, Stat, Tag } from '@/components/ui/misc';
import { Drawer } from '@/components/ui/Overlays';
import { Pills, Segment } from '@/components/ui/Tabs';
import {
  adminApi,
  type GrowthArea,
  type GrowthBoard,
  type GrowthLink,
  type GrowthLog,
  type GrowthPerson,
  type GrowthTask,
  type GrowthTaskStatus,
} from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { ch } from '@/lib/channels';
import { cn } from '@/lib/cn';
import { fmt, timeAgo } from '@/lib/format';
import { confirmAction, toast } from '@/stores/ui';

const KEY = ['admin', 'growth'] as const;
const input =
  'h-10 w-full rounded-option bg-elev2 px-3 text-[14px] outline-none shadow-[inset_0_0_0_0.5px_var(--color-line2)] placeholder:text-faint focus:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.32)]';
const area_ = `${input} h-auto min-h-[92px] py-2.5 leading-relaxed`;
const label = 'mb-1.5 block text-[12.5px] font-semibold text-sub';

const DAYS = [
  { key: '7', label: '7 gün' },
  { key: '30', label: '30 gün' },
  { key: '90', label: '90 gün' },
] as const;

const STATUS: Record<GrowthTaskStatus, { label: string; tone?: 'yellow' | 'up' | 'live' }> = {
  todo: { label: 'Yapılacak' },
  doing: { label: 'Sürüyor', tone: 'yellow' },
  done: { label: 'Bitti', tone: 'up' },
  dropped: { label: 'Bırakıldı', tone: 'live' },
};
const STATUS_ORDER: GrowthTaskStatus[] = ['doing', 'todo', 'done', 'dropped'];

/** Bağlantı kaynağı önerileri (utm_source). */
const SOURCES = [
  { key: 'x', label: 'X (Twitter)' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'discord', label: 'Discord' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'flyer', label: 'El ilanı / QR' },
  { key: 'kulup', label: 'Kulüp' },
  { key: 'youtube', label: 'YouTube' },
] as const;
const sourceLabel = (k: string) => SOURCES.find((s) => s.key === k)?.label ?? k;

const pct = (a: number, b: number) => (b ? `%${Math.round((a / b) * 100)}` : '—');
const today = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
const dayLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
const shortDate = (d: string | Date) => new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

function useBoard() {
  return useQuery({ queryKey: [...KEY, 'board'], queryFn: adminApi.growth.board });
}
function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}
function peopleMap(list: GrowthPerson[] | undefined) {
  return new Map((list ?? []).map((p) => [p.id, p]));
}
/** Ekipteki herkes (bir alana üye olan), tekil. */
function teamOf(board: GrowthBoard | undefined) {
  if (!board) return [];
  const ids = new Set(board.areas.flatMap((a) => a.members.map((m) => m.userId)));
  return board.people.filter((p) => ids.has(p.id)).sort((a, b) => a.username.localeCompare(b.username, 'tr'));
}

function Who({ p, size = 26, sub }: { p: GrowthPerson | undefined; size?: number; sub?: ReactNode }) {
  if (!p) return <span className="text-faint">Atanmamış</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar src={p.avatarPath} name={p.displayName ?? p.username} size={size} />
      <span className="min-w-0">
        <b className="block truncate text-[13px]">{p.displayName ?? `@${p.username}`}</b>
        {sub && <span className="block truncate text-[11.5px] text-faint">{sub}</span>}
      </span>
    </span>
  );
}

function Field({ id, title, hint, children }: { id?: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {title}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11.5px] text-faint">{hint}</p>}
    </div>
  );
}

function Th({ children, right, first }: { children: ReactNode; right?: boolean; first?: boolean }) {
  return <th className={cn('py-2 font-semibold whitespace-nowrap', first ? 'px-[18px]' : 'px-3', right && 'text-right')}>{children}</th>;
}
function Td({ children, right, first, className }: { children: ReactNode; right?: boolean; first?: boolean; className?: string }) {
  return <td className={cn('py-2.5', first ? 'px-[18px]' : 'px-3', right && 'text-right tabular', className)}>{children}</td>;
}

// ─────────────────────────── Genel bakış ───────────────────────────

/** Kayıt · etkinleşen · 7. gün satırı (kanal, kişi, alan, kampanya tabloları ortak). */
function ResultTable({
  title,
  sub,
  rows,
  first,
  extra,
}: {
  title: string;
  sub: string;
  rows: Array<{ key: string; n: number; activated: number; retained: number; eligible: number }>;
  first: (key: string) => ReactNode;
  extra?: { head: string[]; cells: (key: string) => ReactNode[] };
}) {
  return (
    <Card title={title} sub={sub}>
      {rows.length ? (
        <div className="overflow-x-auto pb-2">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-faint">
                <Th first>{title.split(' ')[0]}</Th>
                <Th right>Kayıt</Th>
                <Th right>Etkinleşen</Th>
                <Th right>7. gün</Th>
                {extra?.head.map((h) => (
                  <Th key={h} right>
                    {h}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="shadow-[inset_0_0.5px_0_var(--color-line)]">
                  <Td first className="max-w-[260px]">
                    {first(r.key)}
                  </Td>
                  <Td right>
                    <b>{fmt(r.n)}</b>
                  </Td>
                  <Td right>{pct(r.activated, r.n)}</Td>
                  <Td right>
                    <span title={`${r.retained} / ${r.eligible} kişi (kaydı 7 günü dolanlar)`}>{pct(r.retained, r.eligible)}</span>
                  </Td>
                  {extra?.cells(r.key).map((c, i) => (
                    <Td key={i} right>
                      {c}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon="bar_chart" title="Bu dönemde veri yok" />
      )}
    </Card>
  );
}

export function GrowthOverview() {
  const [days, setDays] = useState<(typeof DAYS)[number]['key']>('30');
  const [view, setView] = useState<'daily' | 'weekly'>('daily');
  const q = useQuery({ queryKey: [...KEY, 'overview', days], queryFn: () => adminApi.growth.overview(Number(days)) });
  const d = q.data;

  const topChannels = useMemo(() => (d?.channels ?? []).slice(0, 5).map((c) => c.key), [d]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Pills items={DAYS.map((x) => ({ key: x.key, label: x.label }))} value={days} onChange={setDays} />
        <p className="text-[12.5px] text-sub">
          Etkinleşen: kaydolduktan sonra listesine dizi ekleyen ya da paylaşım yapan. 7. gün: kayıttan bir hafta sonra hâlâ gelen.
        </p>
      </div>
      {q.isError ? (
        <Card>
          <ErrorState error={q.error} retry={() => q.refetch()} />
        </Card>
      ) : !d ? (
        <Card>
          <Rows n={6} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Yeni kayıt"
              icon="person_add"
              value={fmt(d.total)}
              sub={
                <span className="flex items-center gap-1.5">
                  önceki {days} gün: {fmt(d.prevTotal)} <Delta now={d.total} prev={d.prevTotal} />
                </span>
              }
            />
            <Stat label="Etkinleşen" icon="check_circle" value={pct(d.activated, d.total)} sub={`${fmt(d.activated)} kişi`} />
            <Stat
              label="7. gün dönüşü"
              icon="schedule"
              value={pct(d.retained, d.eligible)}
              sub={`${fmt(d.retained)} / ${fmt(d.eligible)} kişi`}
            />
            <Stat label="Kaynağı bilinen" icon="link" value={pct(d.tracked, d.total)} sub={`${fmt(d.tracked)} kayıt`} />
          </div>

          <Card
            title={view === 'daily' ? 'Günlük kayıt' : 'Haftalık kayıt'}
            sub="kanallara göre"
            right={
              <div className="w-[200px]">
                <Segment
                  items={[
                    { key: 'daily', label: 'Günlük' },
                    { key: 'weekly', label: 'Haftalık' },
                  ]}
                  value={view}
                  onChange={setView}
                />
              </div>
            }
          >
            {view === 'daily' ? (
              <div className="px-[18px] pb-4">
                <DailyBars data={d.daily.map((x) => ({ day: x.day, value: x.total }))} label="kayıt" />
              </div>
            ) : (
              <div className="overflow-x-auto pb-2">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="text-left text-[12px] text-faint">
                      <Th first>Hafta</Th>
                      <Th right>Toplam</Th>
                      {topChannels.map((c) => (
                        <Th key={c} right>
                          {ch(c).label}
                        </Th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...d.weekly].reverse().map((w) => (
                      <tr key={w.week} className="shadow-[inset_0_0.5px_0_var(--color-line)]">
                        <Td first>{shortDate(w.week)} haftası</Td>
                        <Td right>
                          <b>{fmt(w.total)}</b>
                        </Td>
                        {topChannels.map((c) => (
                          <Td key={c} right>
                            {w.channels[c] ? fmt(w.channels[c]) : <span className="text-faint">0</span>}
                          </Td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <ResultTable
            title="Kanal"
            sub="kayıt nereden geldi"
            rows={d.channels}
            first={(k) => (
              <span className="flex items-center gap-1.5">
                <i className="block h-2 w-2 flex-none rounded-full" style={{ background: ch(k).color }} />
                <span className="truncate">{ch(k).label}</span>
              </span>
            )}
          />

          <ResultTable
            title="Kişi"
            sub="kendi bağlantılarından gelen kayıt, kişisel davet, günlük ve biten görev"
            rows={d.people}
            first={(k) => {
              const p = d.people.find((x) => x.key === k)!;
              return <b>{p.displayName ?? `@${p.username}`}</b>;
            }}
            extra={{
              head: ['Davet', 'Günlük', 'Biten görev'],
              cells: (k) => {
                const p = d.people.find((x) => x.key === k)!;
                return [fmt(p.invites), fmt(p.logs), fmt(p.tasksDone)];
              },
            }}
          />

          <div className="grid gap-[18px] lg:grid-cols-2">
            <ResultTable title="Alan" sub="alana bağlı bağlantılardan" rows={d.areas} first={(k) => <b>{k}</b>} />
            <ResultTable title="Kampanya" sub="utm_campaign" rows={d.campaigns} first={(k) => <span>#{k}</span>} />
          </div>

          {d.terms.length > 0 && (
            <Card title="Reklam anahtar kelimeleri" sub="utm_term ile gelen kayıtlar">
              <div className="flex flex-wrap gap-2 px-[18px] pb-4">
                {d.terms.map((t) => (
                  <Tag key={t.key}>
                    {t.key} · {fmt(t.n)}
                  </Tag>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}

// ─────────────────────────── Görevler ───────────────────────────

type TaskDraft = {
  title: string;
  description: string;
  areaId: string;
  assigneeId: string;
  dueAt: string;
  target: string;
  campaign: string;
  status: GrowthTaskStatus;
};
const emptyTask: TaskDraft = {
  title: '',
  description: '',
  areaId: '',
  assigneeId: '',
  dueAt: '',
  target: '',
  campaign: '',
  status: 'todo',
};

function TaskEditor({ board, task, onClose }: { board: GrowthBoard; task: GrowthTask | null; onClose: () => void }) {
  const refresh = useRefresh();
  const [f, setF] = useState<TaskDraft>(
    task
      ? {
          title: task.title,
          description: task.description ?? '',
          areaId: task.areaId ?? '',
          assigneeId: task.assigneeId ?? '',
          dueAt: task.dueAt ? String(task.dueAt).slice(0, 10) : '',
          target: task.target ?? '',
          campaign: task.campaign ?? '',
          status: task.status,
        }
      : emptyTask,
  );
  const set = <K extends keyof TaskDraft>(k: K, v: TaskDraft[K]) => setF((s) => ({ ...s, [k]: v }));
  // Atanacak kişi: seçilen alanın üyeleri önce, sonra tüm ekip.
  const team = teamOf(board);
  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: f.title,
        description: f.description || null,
        areaId: f.areaId || null,
        assigneeId: f.assigneeId || null,
        dueAt: f.dueAt ? `${f.dueAt}T20:59:00.000Z` : null,
        target: f.target || null,
        campaign: f.campaign || null,
        status: f.status,
      };
      return task ? adminApi.growth.updateTask(task.id, body) : adminApi.growth.createTask(body);
    },
    onSuccess: () => {
      toast(task ? 'Görev güncellendi' : 'Görev eklendi');
      void refresh();
      onClose();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (f.title.trim()) save.mutate();
  };
  return (
    <Drawer
      open
      title={task ? 'Görevi düzenle' : 'Yeni görev'}
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" busy={save.isPending} disabled={!f.title.trim()} onClick={() => save.mutate()}>
            {task ? 'Kaydet' : 'Görevi ekle'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4 px-[18px] py-4">
        <Field id="g-title" title="Görev">
          <input
            id="g-title"
            className={input}
            value={f.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="ODTÜ'de 300 el ilanı dağıt"
            autoFocus
          />
        </Field>
        <Field id="g-desc" title="Açıklama">
          <textarea
            id="g-desc"
            className={area_}
            value={f.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Nerede, nasıl, kimlerle"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="g-area" title="Alan">
            <select id="g-area" className={input} value={f.areaId} onChange={(e) => set('areaId', e.target.value)}>
              <option value="">Alan yok</option>
              {board.areas
                .filter((a) => !a.archived || a.id === f.areaId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field id="g-who" title="Kime">
            <select id="g-who" className={input} value={f.assigneeId} onChange={(e) => set('assigneeId', e.target.value)}>
              <option value="">Atanmamış</option>
              {team.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName ?? p.username} (@{p.username})
                </option>
              ))}
            </select>
          </Field>
          <Field id="g-due" title="Son gün">
            <input id="g-due" type="date" className={input} value={f.dueAt} onChange={(e) => set('dueAt', e.target.value)} />
          </Field>
          <Field id="g-status" title="Durum">
            <select id="g-status" className={input} value={f.status} onChange={(e) => set('status', e.target.value as GrowthTaskStatus)}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS[s].label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="g-target" title="Hedef" hint="Ölçülebilir olsun: 50 kayıt, 3 kulüp">
            <input id="g-target" className={input} value={f.target} onChange={(e) => set('target', e.target.value)} />
          </Field>
          <Field id="g-camp" title="Kampanya" hint="Bağlantılardaki kampanya adı; sonuç bundan sayılır">
            <input
              id="g-camp"
              className={input}
              value={f.campaign}
              onChange={(e) => set('campaign', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="odtu-ilan"
            />
          </Field>
        </div>
        {team.length === 0 && (
          <p className="text-[12.5px] text-sub">Görev atamak için önce Ekip ve alanlar sekmesinden kişileri alanlara ekle.</p>
        )}
      </form>
    </Drawer>
  );
}

function TaskRow({ t, board, canManage, onEdit }: { t: GrowthTask; board: GrowthBoard; canManage: boolean; onEdit: () => void }) {
  const refresh = useRefresh();
  const people = peopleMap(board.people);
  const area = board.areas.find((a) => a.id === t.areaId);
  const mine = t.assigneeId === board.meId;
  const canStatus = canManage || mine;
  const [note, setNote] = useState(t.resultNote ?? '');
  const [noteOpen, setNoteOpen] = useState(false);
  const update = useMutation({
    mutationFn: (b: { status?: GrowthTaskStatus; resultNote?: string | null }) => adminApi.growth.updateTask(t.id, b),
    onSuccess: () => void refresh(),
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const del = useMutation({
    mutationFn: () => adminApi.growth.deleteTask(t.id),
    onSuccess: () => {
      toast('Görev silindi');
      void refresh();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const overdue = t.dueAt && t.status !== 'done' && t.status !== 'dropped' && new Date(t.dueAt).getTime() < Date.now();
  return (
    <div className="flex flex-col gap-2 px-[18px] py-3 shadow-[inset_0_0.5px_0_var(--color-line)]">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={cn('text-[14px] font-semibold', t.status === 'dropped' && 'text-sub line-through')}>{t.title}</p>
          {t.description && <p className="mt-0.5 text-[12.5px] whitespace-pre-line text-sub">{t.description}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-sub">
            {area && <Tag>{area.name}</Tag>}
            {t.dueAt && (
              <Tag tone={overdue ? 'live' : undefined}>
                <Icon name="schedule" size={13} />
                {shortDate(t.dueAt)}
                {overdue ? ' · gecikti' : ''}
              </Tag>
            )}
            {t.target && <Tag>Hedef: {t.target}</Tag>}
            {t.campaign && (
              <Tag tone="yellow">
                #{t.campaign} · {fmt(t.signups ?? 0)} kayıt
              </Tag>
            )}
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          <Who p={t.assigneeId ? people.get(t.assigneeId) : undefined} />
          {canStatus ? (
            <select
              aria-label="Durum"
              className={cn(input, 'h-8 w-[120px] text-[12.5px]')}
              value={t.status}
              onChange={(e) => update.mutate({ status: e.target.value as GrowthTaskStatus })}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS[s].label}
                </option>
              ))}
            </select>
          ) : (
            <Tag tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Tag>
          )}
          {canStatus && <IconButton icon="edit_note" label="Sonuç notu" onClick={() => setNoteOpen((v) => !v)} />}
          {canManage && <IconButton icon="edit" label="Düzenle" onClick={onEdit} />}
          {canManage && (
            <IconButton
              icon="delete"
              label="Sil"
              onClick={async () => {
                const c = await confirmAction({ title: 'Görev silinsin mi?', body: t.title, ok: 'Sil', danger: true });
                if (c.ok) del.mutate();
              }}
            />
          )}
        </div>
      </div>
      {t.resultNote && !noteOpen && (
        <p className="rounded-option bg-elev2 px-3 py-2 text-[12.5px] whitespace-pre-line text-sub">
          <b className="text-text">Sonuç:</b> {t.resultNote}
        </p>
      )}
      {noteOpen && (
        <div className="flex flex-col gap-2">
          <textarea
            className={area_}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ne oldu? Kaç kişiye ulaştın, ne işe yaradı?"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              busy={update.isPending}
              onClick={() => update.mutate({ resultNote: note.trim() || null }, { onSuccess: () => setNoteOpen(false) })}
            >
              Notu kaydet
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNoteOpen(false)}>
              Vazgeç
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function GrowthTasks() {
  const q = useBoard();
  const [who, setWho] = useState<'mine' | 'all'>('all');
  const [areaId, setAreaId] = useState('');
  const [edit, setEdit] = useState<GrowthTask | 'new' | null>(null);
  const b = q.data;
  useEffect(() => {
    // Ekip üyesi kendi görevleriyle açar; admin herkesinkiyle.
    if (b && !b.canManage && b.tasks.some((t) => t.assigneeId === b.meId)) setWho('mine');
  }, [b]);
  if (q.isError)
    return (
      <Card>
        <ErrorState error={q.error} retry={() => q.refetch()} />
      </Card>
    );
  if (!b)
    return (
      <Card>
        <Rows n={6} />
      </Card>
    );
  const list = b.tasks.filter((t) => (who === 'all' || t.assigneeId === b.meId) && (!areaId || t.areaId === areaId));
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Pills
          items={[
            {
              key: 'mine',
              label: 'Bana atanan',
              count: b.tasks.filter((t) => t.assigneeId === b.meId && t.status !== 'done' && t.status !== 'dropped').length,
            },
            { key: 'all', label: 'Hepsi', count: b.tasks.length },
          ]}
          value={who}
          onChange={setWho}
        />
        <select
          aria-label="Alan"
          className={cn(input, 'h-8 w-auto min-w-[150px] text-[13px]')}
          value={areaId}
          onChange={(e) => setAreaId(e.target.value)}
        >
          <option value="">Bütün alanlar</option>
          {b.areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {b.canManage && (
          <Button className="ml-auto" variant="primary" icon="add" onClick={() => setEdit('new')}>
            Yeni görev
          </Button>
        )}
      </div>
      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon="task_alt"
            title={who === 'mine' ? 'Sana atanmış görev yok' : 'Henüz görev yok'}
            body={
              b.canManage
                ? 'Yeni görev ekleyip ekipten birine ata. Kampanya adı verirsen kaç kayıt getirdiği burada görünür.'
                : 'Görev atandığında burada görünür.'
            }
          />
        </Card>
      ) : (
        STATUS_ORDER.map((s) => {
          const rows = list.filter((t) => t.status === s);
          if (!rows.length) return null;
          return (
            <Card key={s} title={STATUS[s].label} sub={`${rows.length} görev`}>
              <div className="pb-1">
                {rows.map((t) => (
                  <TaskRow key={t.id} t={t} board={b} canManage={b.canManage} onEdit={() => setEdit(t)} />
                ))}
              </div>
            </Card>
          );
        })
      )}
      {edit && <TaskEditor board={b} task={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

// ─────────────────────────── Günlük ───────────────────────────

function LogComposer({ board, onDone }: { board: GrowthBoard; onDone: () => void }) {
  const myAreas = board.areas.filter((a) => a.members.some((m) => m.userId === board.meId));
  const myTasks = board.tasks.filter((t) => t.assigneeId === board.meId && (t.status === 'todo' || t.status === 'doing'));
  const [day, setDay] = useState(today());
  const [text, setText] = useState('');
  const [areaId, setAreaId] = useState(myAreas.length === 1 ? myAreas[0].id : '');
  const [taskId, setTaskId] = useState('');
  const save = useMutation({
    mutationFn: () => adminApi.growth.createLog({ day, text, areaId: areaId || null, taskId: taskId || null }),
    onSuccess: () => {
      toast('Günlüğe yazıldı');
      setText('');
      setTaskId('');
      onDone();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  return (
    <Card title="Bugün ne yaptın?" sub="kısa ve sayılı yaz: nerede, kaç kişi, ne oldu">
      <form
        className="flex flex-col gap-3 px-[18px] pb-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) save.mutate();
        }}
      >
        <textarea
          aria-label="Günlük metni"
          className={area_}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Bilkent kampüsünde 150 el ilanı dağıttım, 2 kulüp başkanıyla konuştum, Perşembe toplantıya çağırdılar."
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            aria-label="Gün"
            type="date"
            className={cn(input, 'h-9 w-[160px]')}
            value={day}
            max={today()}
            onChange={(e) => setDay(e.target.value)}
          />
          <select
            aria-label="Alan"
            className={cn(input, 'h-9 w-auto min-w-[140px]')}
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
          >
            <option value="">Alan seç</option>
            {(myAreas.length ? myAreas : board.areas).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {myTasks.length > 0 && (
            <select
              aria-label="Görev"
              className={cn(input, 'h-9 w-auto max-w-[260px] min-w-[140px]')}
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
            >
              <option value="">Görevle ilgili değil</option>
              {myTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          )}
          <Button type="submit" className="ml-auto" variant="primary" busy={save.isPending} disabled={!text.trim()}>
            Kaydet
          </Button>
        </div>
      </form>
    </Card>
  );
}

function LogItem({ l, board, people }: { l: GrowthLog; board: GrowthBoard; people: Map<string, GrowthPerson> }) {
  const refresh = useRefresh();
  const mine = l.userId === board.meId;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(l.text);
  const area = board.areas.find((a) => a.id === l.areaId);
  const task = board.tasks.find((t) => t.id === l.taskId);
  const save = useMutation({
    mutationFn: () => adminApi.growth.updateLog(l.id, { text }),
    onSuccess: () => {
      setEditing(false);
      void refresh();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const del = useMutation({
    mutationFn: () => adminApi.growth.deleteLog(l.id),
    onSuccess: () => void refresh(),
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  return (
    <div className="flex gap-3 px-[18px] py-3 shadow-[inset_0_0.5px_0_var(--color-line)]">
      <Avatar src={people.get(l.userId)?.avatarPath} name={people.get(l.userId)?.username ?? '?'} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
          <b className="text-[13.5px]">{people.get(l.userId)?.displayName ?? `@${people.get(l.userId)?.username ?? '—'}`}</b>
          {area && <Tag>{area.name}</Tag>}
          {task && <Tag tone="yellow">{task.title}</Tag>}
          <span className="text-faint">{timeAgo(l.createdAt)}</span>
        </div>
        {editing ? (
          <div className="mt-2 flex flex-col gap-2">
            <textarea aria-label="Günlük metni" className={area_} value={text} onChange={(e) => setText(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" variant="primary" busy={save.isPending} disabled={!text.trim()} onClick={() => save.mutate()}>
                Kaydet
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Vazgeç
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-[13.5px] leading-relaxed whitespace-pre-line">{l.text}</p>
        )}
      </div>
      {(mine || board.canManage) && !editing && (
        <div className="flex flex-none items-start gap-0.5">
          {mine && <IconButton icon="edit" label="Düzenle" size={19} onClick={() => setEditing(true)} />}
          <IconButton
            icon="delete"
            label="Sil"
            size={19}
            onClick={async () => {
              const c = await confirmAction({ title: 'Kayıt silinsin mi?', body: l.text.slice(0, 120), ok: 'Sil', danger: true });
              if (c.ok) del.mutate();
            }}
          />
        </div>
      )}
    </div>
  );
}

export function GrowthLogs() {
  const board = useBoard();
  const [days, setDays] = useState<'7' | '14' | '30'>('14');
  const [userId, setUserId] = useState('');
  const q = useQuery({
    queryKey: [...KEY, 'logs', days, userId],
    queryFn: () => adminApi.growth.logs(Number(days), userId || undefined),
  });
  const b = board.data;
  const people = peopleMap([...(b?.people ?? []), ...(q.data?.people ?? [])]);
  const byDay = useMemo(() => {
    const m = new Map<string, GrowthLog[]>();
    for (const l of q.data?.items ?? []) m.set(l.day, [...(m.get(l.day) ?? []), l]);
    return [...m.entries()];
  }, [q.data]);
  if (board.isError || q.isError)
    return (
      <Card>
        <ErrorState error={board.error ?? q.error} retry={() => void Promise.all([board.refetch(), q.refetch()])} />
      </Card>
    );
  if (!b)
    return (
      <Card>
        <Rows n={4} />
      </Card>
    );
  const team = teamOf(b);
  return (
    <>
      <LogComposer board={b} onDone={() => void q.refetch()} />
      <div className="flex flex-wrap items-center gap-3">
        <Pills
          items={[
            { key: '7', label: '7 gün' },
            { key: '14', label: '14 gün' },
            { key: '30', label: '30 gün' },
          ]}
          value={days}
          onChange={setDays}
        />
        <select
          aria-label="Kişi"
          className={cn(input, 'h-8 w-auto min-w-[160px] text-[13px]')}
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        >
          <option value="">Herkes</option>
          <option value={b.meId}>Yalnız ben</option>
          {team
            .filter((p) => p.id !== b.meId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName ?? p.username}
              </option>
            ))}
        </select>
      </div>
      {!q.data ? (
        <Card>
          <Rows n={4} />
        </Card>
      ) : byDay.length === 0 ? (
        <Card>
          <EmptyState
            icon="edit_note"
            title="Bu dönemde kayıt yok"
            body="Her gün yaptığını iki üç cümleyle yaz; neyin işe yaradığı haftalar içinde buradan görünür."
          />
        </Card>
      ) : (
        byDay.map(([day, items]) => (
          <Card key={day} title={dayLabel(day)} sub={`${items.length} kayıt`}>
            <div className="pb-1">
              {items.map((l) => (
                <LogItem key={l.id} l={l} board={b} people={people} />
              ))}
            </div>
          </Card>
        ))
      )}
    </>
  );
}

// ─────────────────────────── Bağlantılar ───────────────────────────

async function copy(text: string, what = 'Bağlantı') {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${what} kopyalandı`);
  } catch {
    toast('Kopyalanamadı, elle seç', 'error');
  }
}

function QrDrawer({ link, onClose }: { link: GrowthLink; onClose: () => void }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    void QRCode.toString(link.shortUrl, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    }).then(setSvg);
  }, [link.shortUrl]);
  const download = async () => {
    // Baskıya yetecek çözünürlükte PNG (el ilanı, afiş).
    const url = await QRCode.toDataURL(link.shortUrl, { width: 1200, margin: 2, errorCorrectionLevel: 'M' });
    const a = document.createElement('a');
    a.href = url;
    a.download = `letstalkin-${link.code}.png`;
    a.click();
  };
  return (
    <Drawer
      open
      title="QR kod"
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" icon="download" onClick={download}>
            PNG indir
          </Button>
          <Button variant="ghost" icon="content_copy" onClick={() => copy(link.shortUrl)}>
            Bağlantıyı kopyala
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 px-[18px] py-6">
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: kendi ürettiğimiz QR SVG'si */}
        <div className="w-[min(320px,100%)] overflow-hidden rounded-card bg-white p-3" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="text-center text-[15px] font-semibold">{link.label}</p>
        <p className="text-center text-[13px] break-all text-sub">{link.shortUrl}</p>
        <p className="max-w-[40ch] text-center text-[12.5px] text-faint">
          Okutan her telefon bir tıklama sayılır; kayıt olursa bu bağlantının ve sahibinin hanesine yazılır.
        </p>
      </div>
    </Drawer>
  );
}

type LinkDraft = {
  label: string;
  code: string;
  ownerId: string;
  areaId: string;
  source: string;
  medium: string;
  campaign: string;
  path: string;
};

function LinkEditor({ board, onClose }: { board: GrowthBoard; onClose: () => void }) {
  const refresh = useRefresh();
  const myArea = board.areas.find((a) => a.members.some((m) => m.userId === board.meId));
  const [f, setF] = useState<LinkDraft>({
    label: '',
    code: '',
    ownerId: board.meId,
    areaId: myArea?.id ?? '',
    source: myArea?.channel ?? 'x',
    medium: '',
    campaign: '',
    path: '/',
  });
  const set = <K extends keyof LinkDraft>(k: K, v: LinkDraft[K]) => setF((s) => ({ ...s, [k]: v }));
  const slug = (v: string) =>
    v
      .toLocaleLowerCase('tr-TR')
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9._-]+/g, '-');
  const save = useMutation({
    mutationFn: () =>
      adminApi.growth.createLink({
        label: f.label,
        code: f.code || undefined,
        ownerId: f.ownerId || null,
        areaId: f.areaId || null,
        source: f.source,
        medium: f.medium || null,
        campaign: f.campaign || null,
        path: f.path || '/',
      }),
    onSuccess: () => {
      toast('Bağlantı açıldı', 'success', 'Kopyalayıp paylaşabilir ya da QR indirebilirsin');
      void refresh();
      onClose();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const ok = f.label.trim() && f.source;
  return (
    <Drawer
      open
      title="Yeni bağlantı"
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" busy={save.isPending} disabled={!ok} onClick={() => save.mutate()}>
            Bağlantıyı aç
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-[18px] py-4">
        <Field id="l-label" title="Ne için" hint="Kendin için not: hangi tweet, hangi ilan, hangi kulüp">
          <input
            id="l-label"
            className={input}
            value={f.label}
            onChange={(e) => set('label', e.target.value)}
            placeholder="ODTÜ yemekhane ilanı"
            autoFocus
          />
        </Field>
        <Field title="Nerede paylaşılacak">
          <div className="flex flex-wrap gap-2">
            {SOURCES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => set('source', s.key)}
                className={cn(
                  'press h-8 rounded-full px-3.5 text-[13px] font-semibold',
                  f.source === s.key
                    ? 'bg-text text-black'
                    : 'bg-elev2 text-sub shadow-[inset_0_0_0_0.5px_var(--color-line2)] hover:text-text',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <input
            aria-label="Başka kaynak"
            className={cn(input, 'mt-2')}
            value={SOURCES.some((s) => s.key === f.source) ? '' : f.source}
            onChange={(e) => set('source', slug(e.target.value))}
            placeholder="Başka bir yer (ör. eksisozluk)"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          {board.canManage && (
            <Field id="l-owner" title="Kimin bağlantısı">
              <select id="l-owner" className={input} value={f.ownerId} onChange={(e) => set('ownerId', e.target.value)}>
                <option value="">Kimse (genel)</option>
                <option value={board.meId}>Ben</option>
                {teamOf(board)
                  .filter((p) => p.id !== board.meId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName ?? p.username}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          <Field id="l-area" title="Alan">
            <select id="l-area" className={input} value={f.areaId} onChange={(e) => set('areaId', e.target.value)}>
              <option value="">Alan yok</option>
              {board.areas
                .filter((a) => !a.archived)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field id="l-camp" title="Kampanya" hint="Aynı işin bağlantılarını toplar: odtu-ilan, kulup-sinema">
            <input id="l-camp" className={input} value={f.campaign} onChange={(e) => set('campaign', slug(e.target.value))} />
          </Field>
          <Field id="l-medium" title="Biçim" hint="İsteğe bağlı: social, print, dm, story">
            <input id="l-medium" className={input} value={f.medium} onChange={(e) => set('medium', slug(e.target.value))} />
          </Field>
          <Field id="l-path" title="Açılacak sayfa" hint="Boş bırakırsan ana sayfa; /dizi/… da olur">
            <input id="l-path" className={input} value={f.path} onChange={(e) => set('path', e.target.value.trim() || '/')} />
          </Field>
          <Field id="l-code" title="Kısa kod" hint="Boşsa otomatik: letstalkin.com/g/kod">
            <input
              id="l-code"
              className={input}
              value={f.code}
              onChange={(e) => set('code', slug(e.target.value).replace(/[._]/g, '-'))}
              placeholder="odtu1"
            />
          </Field>
        </div>
      </div>
    </Drawer>
  );
}

export function GrowthLinks() {
  const board = useBoard();
  const q = useQuery({ queryKey: [...KEY, 'links'], queryFn: adminApi.growth.links });
  const refresh = useRefresh();
  const [creating, setCreating] = useState(false);
  const [qr, setQr] = useState<GrowthLink | null>(null);
  const [archived, setArchived] = useState(false);
  const [who, setWho] = useState<'mine' | 'all'>('all');
  const archive = useMutation({
    mutationFn: (l: GrowthLink) => adminApi.growth.updateLink(l.id, { archived: !l.archived }),
    onSuccess: (_, l) => {
      toast(
        l.archived ? 'Bağlantı yeniden açıldı' : 'Bağlantı arşivlendi',
        'success',
        l.archived ? undefined : 'Artık yönlenmez, sonuçları durur',
      );
      void refresh();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const b = board.data;
  if (board.isError || q.isError)
    return (
      <Card>
        <ErrorState error={board.error ?? q.error} retry={() => void Promise.all([board.refetch(), q.refetch()])} />
      </Card>
    );
  if (!b || !q.data)
    return (
      <Card>
        <Rows n={5} />
      </Card>
    );
  const people = peopleMap([...b.people, ...q.data.people]);
  const rows = q.data.items.filter((l) => l.archived === archived && (who === 'all' || l.ownerId === b.meId));
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Pills
          items={[
            { key: 'mine', label: 'Benim', count: q.data.items.filter((l) => l.ownerId === b.meId && !l.archived).length },
            { key: 'all', label: 'Hepsi', count: q.data.items.filter((l) => !l.archived).length },
          ]}
          value={who}
          onChange={setWho}
        />
        <Button size="sm" variant={archived ? 'secondary' : 'ghost'} icon="archive" onClick={() => setArchived((v) => !v)}>
          {archived ? 'Arşivdekiler' : 'Arşivi göster'}
        </Button>
        <Button className="ml-auto" variant="primary" icon="add" onClick={() => setCreating(true)}>
          Yeni bağlantı
        </Button>
      </div>
      <p className="-mt-1 text-[12.5px] text-sub">
        Her paylaşıma ayrı bağlantı aç: kim, nerede, hangi kampanyayla getirdi ayrı ayrı sayılır. Tıklama önizleme botlarını saymaz.
      </p>
      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon="link"
            title={archived ? 'Arşivde bağlantı yok' : 'Henüz bağlantı yok'}
            body="Tweet, Instagram hikâyesi, el ilanı QR'ı ya da kulüp grubu için bir bağlantı aç; gelenler burada sayılır."
          />
        ) : (
          <div className="overflow-x-auto pb-2">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-[12px] text-faint">
                  <Th first>Bağlantı</Th>
                  <Th>Kimin</Th>
                  <Th>Nerede</Th>
                  <Th right>Tıklama</Th>
                  <Th right>Kayıt</Th>
                  <Th right>Dönüşüm</Th>
                  <Th right>Etkinleşen</Th>
                  <Th right> </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const area = b.areas.find((a) => a.id === l.areaId);
                  const canEdit = b.canManage || l.ownerId === b.meId;
                  return (
                    <tr key={l.id} className="shadow-[inset_0_0.5px_0_var(--color-line)]">
                      <Td first className="max-w-[280px]">
                        <b className="block truncate">{l.label}</b>
                        <button
                          type="button"
                          onClick={() => copy(l.shortUrl)}
                          className="press block max-w-full truncate text-[11.5px] text-sub hover:text-text"
                          title="Kopyala"
                        >
                          {l.shortUrl.replace(/^https?:\/\//, '')}
                        </button>
                      </Td>
                      <Td>
                        <Who p={l.ownerId ? people.get(l.ownerId) : undefined} size={24} />
                      </Td>
                      <Td className="whitespace-nowrap text-sub">
                        {sourceLabel(l.source)}
                        {l.campaign && <span className="block text-[11.5px] text-faint">#{l.campaign}</span>}
                        {area && <span className="block text-[11.5px] text-faint">{area.name}</span>}
                      </Td>
                      <Td right>{fmt(l.clicks)}</Td>
                      <Td right>
                        <b>{fmt(l.signups)}</b>
                      </Td>
                      <Td right>{pct(l.signups, l.clicks)}</Td>
                      <Td right>{pct(l.activated, l.signups)}</Td>
                      <Td right>
                        <span className="flex justify-end gap-0.5">
                          <IconButton icon="content_copy" label="Kısa bağlantıyı kopyala" size={19} onClick={() => copy(l.shortUrl)} />
                          <IconButton icon="qr_code_2" label="QR kod" size={19} onClick={() => setQr(l)} />
                          {canEdit && (
                            <IconButton
                              icon={l.archived ? 'unarchive' : 'archive'}
                              label={l.archived ? 'Arşivden çıkar' : 'Arşivle'}
                              size={19}
                              onClick={() => archive.mutate(l)}
                            />
                          )}
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {creating && <LinkEditor board={b} onClose={() => setCreating(false)} />}
      {qr && <QrDrawer link={qr} onClose={() => setQr(null)} />}
    </>
  );
}

// ─────────────────────────── Ekip ve alanlar ───────────────────────────

function AreaEditor({ area, onClose }: { area: GrowthArea | null; onClose: () => void }) {
  const refresh = useRefresh();
  const [name, setName] = useState(area?.name ?? '');
  const [description, setDescription] = useState(area?.description ?? '');
  const [channel, setChannel] = useState(area?.channel ?? '');
  const save = useMutation({
    mutationFn: () => {
      const body = { name, description: description || null, channel: channel || null };
      return area ? adminApi.growth.updateArea(area.id, body) : adminApi.growth.createArea(body);
    },
    onSuccess: () => {
      toast(area ? 'Alan güncellendi' : 'Alan açıldı');
      void refresh();
      onClose();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  return (
    <Drawer
      open
      title={area ? 'Alanı düzenle' : 'Yeni alan'}
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" busy={save.isPending} disabled={!name.trim()} onClick={() => save.mutate()}>
            {area ? 'Kaydet' : 'Alanı aç'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-[18px] py-4">
        <Field id="a-name" title="Alan adı">
          <input
            id="a-name"
            className={input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ankara üniversiteleri"
            autoFocus
          />
        </Field>
        <Field id="a-desc" title="Ne yapılıyor">
          <textarea
            id="a-desc"
            className={area_}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Kampüslerde el ilanı, stant, öğrenci toplulukları"
          />
        </Field>
        <Field id="a-ch" title="Varsayılan kaynak" hint="Bu alanda açılan bağlantılar bununla başlar">
          <select id="a-ch" className={input} value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">Yok</option>
            {SOURCES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Drawer>
  );
}

function AddMember({ areaId }: { areaId: string }) {
  const refresh = useRefresh();
  const [username, setUsername] = useState('');
  const [note, setNote] = useState('');
  const add = useMutation({
    mutationFn: () => adminApi.growth.addMember({ username, areaId, note: note || null }),
    onSuccess: (r) => {
      toast(
        `@${username.replace(/^@/, '')} eklendi`,
        'success',
        r.promoted ? 'Panelde yalnız Büyüme bölümünü görür. İlk girişte iki adımlı doğrulamayı açması gerekir.' : undefined,
      );
      setUsername('');
      setNote('');
      void refresh();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  return (
    <form
      className="flex flex-wrap items-center gap-2 px-[18px] pt-1 pb-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (username.trim()) add.mutate();
      }}
    >
      <input
        aria-label="Kullanıcı adı"
        className={cn(input, 'h-9 w-[170px]')}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="@kullaniciadi"
      />
      <input
        aria-label="Sorumluluğu"
        className={cn(input, 'h-9 min-w-[160px] flex-1')}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Sorumluluğu (ör. ODTÜ, Bilkent)"
      />
      <Button type="submit" size="sm" icon="add" busy={add.isPending} disabled={!username.trim()}>
        Ekle
      </Button>
    </form>
  );
}

export function GrowthTeam() {
  const q = useBoard();
  const refresh = useRefresh();
  const [edit, setEdit] = useState<GrowthArea | 'new' | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.growth.removeMember(id),
    onSuccess: (r) => {
      toast('Alandan çıkarıldı', 'success', r.demoted ? 'Başka alanı kalmadığı için panel yetkisi de kaldırıldı' : undefined);
      void refresh();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const delArea = useMutation({
    mutationFn: (id: string) => adminApi.growth.deleteArea(id),
    onSuccess: () => {
      toast('Alan silindi');
      void refresh();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const archiveArea = useMutation({
    mutationFn: (a: GrowthArea) => adminApi.growth.updateArea(a.id, { archived: !a.archived }),
    onSuccess: () => void refresh(),
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const b = q.data;
  if (q.isError)
    return (
      <Card>
        <ErrorState error={q.error} retry={() => q.refetch()} />
      </Card>
    );
  if (!b)
    return (
      <Card>
        <Rows n={5} />
      </Card>
    );
  const people = peopleMap(b.people);
  const ROLE: Record<string, string> = { growth: 'Büyüme ekibi', moderator: 'Moderatör', admin: 'Admin', user: 'Yetkisiz' };
  const openTasks = (uid: string) => b.tasks.filter((t) => t.assigneeId === uid && (t.status === 'todo' || t.status === 'doing')).length;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-[12.5px] text-sub">
          {b.canManage
            ? 'Alan aç, kişileri kullanıcı adıyla ekle. Sıradan hesap eklenince panelde yalnız Büyüme bölümünü görür; moderatörler rolünü korur. Bir kişi birden çok alanda olabilir.'
            : 'Kim hangi alanda. Alan ve üyeleri admin düzenler.'}
        </p>
        {b.canManage && (
          <Button variant="primary" icon="add" onClick={() => setEdit('new')}>
            Yeni alan
          </Button>
        )}
      </div>
      {b.areas.length === 0 ? (
        <Card>
          <EmptyState
            icon="groups"
            title="Henüz alan yok"
            body="Örnek: Twitter ve Discord, Ankara üniversiteleri, Sosyal medya, Üniversite kulüpleri, Mobil ve reklam."
          />
        </Card>
      ) : (
        <div className="grid gap-[18px] lg:grid-cols-2">
          {b.areas.map((a) => (
            <Card
              key={a.id}
              className={cn(a.archived && 'opacity-60')}
              title={a.name}
              sub={[a.channel && sourceLabel(a.channel), `${a.members.length} kişi`, a.archived && 'arşivde'].filter(Boolean).join(' · ')}
              right={
                b.canManage && (
                  <span className="flex gap-0.5">
                    <IconButton icon="edit" label="Düzenle" size={19} onClick={() => setEdit(a)} />
                    <IconButton
                      icon={a.archived ? 'unarchive' : 'archive'}
                      label={a.archived ? 'Arşivden çıkar' : 'Arşivle'}
                      size={19}
                      onClick={() => archiveArea.mutate(a)}
                    />
                    <IconButton
                      icon="delete"
                      label="Sil"
                      size={19}
                      onClick={async () => {
                        const c = await confirmAction({
                          title: `${a.name} silinsin mi?`,
                          body: 'Üyelikler silinir; görev, günlük ve bağlantılar kalır ama alansız görünür.',
                          ok: 'Sil',
                          danger: true,
                        });
                        if (c.ok) delArea.mutate(a.id);
                      }}
                    />
                  </span>
                )
              }
            >
              {a.description && <p className="-mt-1 px-[18px] pb-3 text-[13px] text-sub">{a.description}</p>}
              <div className="pb-1">
                {a.members.map((m) => {
                  const p = people.get(m.userId);
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-[18px] py-2.5 shadow-[inset_0_0.5px_0_var(--color-line)]">
                      <div className="min-w-0 flex-1">
                        <Who p={p} size={30} sub={[p && `@${p.username}`, m.note].filter(Boolean).join(' · ')} />
                      </div>
                      {p && p.role !== 'growth' && <Tag tone={p.role === 'admin' ? 'yellow' : undefined}>{ROLE[p.role] ?? p.role}</Tag>}
                      {openTasks(m.userId) > 0 && <Tag>{openTasks(m.userId)} açık görev</Tag>}
                      {b.canManage && (
                        <IconButton
                          icon="close"
                          label="Alandan çıkar"
                          size={19}
                          onClick={async () => {
                            const c = await confirmAction({
                              title: `@${p?.username ?? ''} ${a.name} alanından çıkarılsın mı?`,
                              body: 'Başka alanı yoksa ve büyüme ekibi rolündeyse panel yetkisi de kalkar.',
                              ok: 'Çıkar',
                              danger: true,
                            });
                            if (c.ok) remove.mutate(m.id);
                          }}
                        />
                      )}
                    </div>
                  );
                })}
                {a.members.length === 0 && <p className="px-[18px] py-3 text-[13px] text-faint">Bu alanda henüz kimse yok.</p>}
              </div>
              {b.canManage && !a.archived && <AddMember areaId={a.id} />}
            </Card>
          ))}
        </div>
      )}
      {edit && <AreaEditor area={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

// ─────────────────────────── Google aramaları ───────────────────────────

export function GrowthSearch() {
  const [days, setDays] = useState<'7' | '28' | '90'>('28');
  const q = useQuery({ queryKey: [...KEY, 'search', days], queryFn: () => adminApi.growth.search(Number(days)) });
  const d = q.data;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Pills
          items={[
            { key: '7', label: '7 gün' },
            { key: '28', label: '28 gün' },
            { key: '90', label: '90 gün' },
          ]}
          value={days}
          onChange={setDays}
        />
        <p className="text-[12.5px] text-sub">
          Google, kimin neyi aradığını vermez; sözcükler toplu gelir ve 2–3 gün geriden gelir. Kişi bazında kaynak için bağlantıları kullan.
        </p>
      </div>
      {q.isError ? (
        <Card>
          <ErrorState error={q.error} retry={() => q.refetch()} />
        </Card>
      ) : !d ? (
        <Card>
          <Rows n={6} />
        </Card>
      ) : !d.connected ? (
        <Card>
          <EmptyState
            icon="search"
            title="Search Console bağlı değil"
            body="Sunucuya Google servis hesabı ve Search Console mülkü tanımlanınca arama sözcükleri burada görünür (Analiz → Google)."
          />
        </Card>
      ) : (
        <>
          {d.totals && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Tıklama" icon="open_in_new" value={fmt(d.totals.clicks)} />
              <Stat label="Gösterim" icon="search" value={fmt(d.totals.impressions)} />
              <Stat label="Tıklama oranı" icon="trending_up" value={`%${d.totals.ctr}`} />
              <Stat label="Ortalama sıra" icon="bar_chart" value={d.totals.position} />
            </div>
          )}
          {[
            { title: 'Arama sözcükleri', rows: d.queries, first: 'Sözcük' },
            { title: 'Google’dan girilen sayfalar', rows: d.pages, first: 'Sayfa' },
          ].map((t) => (
            <Card
              key={t.title}
              title={t.title}
              sub={d.range ? `${shortDate(d.range.startDate)} – ${shortDate(d.range.endDate)}` : undefined}
            >
              <div className="overflow-x-auto pb-2">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="text-left text-[12px] text-faint">
                      <Th first>{t.first}</Th>
                      <Th right>Tıklama</Th>
                      <Th right>Gösterim</Th>
                      <Th right>Oran</Th>
                      <Th right>Sıra</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.rows.map((r) => (
                      <tr key={r.key} className="shadow-[inset_0_0.5px_0_var(--color-line)]">
                        <Td first className="max-w-[420px]">
                          <span className="block truncate" title={r.key}>
                            {r.key.replace(/^https?:\/\/(www\.)?letstalkin\.com/, '') || '/'}
                          </span>
                        </Td>
                        <Td right>
                          <b>{fmt(r.clicks)}</b>
                        </Td>
                        <Td right>{fmt(r.impressions)}</Td>
                        <Td right>%{r.ctr}</Td>
                        <Td right>{r.position}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </>
      )}
    </>
  );
}
