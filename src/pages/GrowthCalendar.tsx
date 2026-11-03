// Büyüme · Takvim ve hedefler: ay takvimi üzerinde her gün kaç kullanıcı vardı, kaç kişi geldi ve
// kullandı, o gün ne yapıldı (olay, biten görev, günlük), ileride ne planlı; üstte hedefler ve hız.
import { useMutation, useQuery } from '@tanstack/react-query';
import { type ReactNode, useMemo, useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { Gantt, type GanttGroup, MonthNav } from '@/components/ui/Gantt';
import { Icon } from '@/components/ui/Icon';
import { Card, EmptyState, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { Drawer } from '@/components/ui/Overlays';
import { Segment } from '@/components/ui/Tabs';
import {
  adminApi,
  type GrowthCalendar as Cal,
  type GrowthBoard,
  type GrowthGoal,
  type GrowthGoalInput,
  type GrowthTask,
} from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { fmt } from '@/lib/format';
import { confirmAction, toast } from '@/stores/ui';
import {
  area_,
  Field,
  GanttLegend,
  input,
  KEY,
  peopleMap,
  TaskEditor,
  TaskRow,
  taskTone,
  teamOf,
  useBoard,
  useRefresh,
  Who,
} from './Growth';

type Metric = GrowthGoal['metric'];
type Kind = Cal['events'][number]['kind'];

const METRIC: Record<Metric, { label: string; hint: string }> = {
  users: { label: 'Toplam kullanıcı', hint: 'Silinmemiş bütün hesaplar' },
  active7: { label: 'Haftalık aktif', hint: 'Son 7 günde uygulamayı açan' },
  signups: { label: 'Yeni kayıt', hint: 'Başlangıç tarihinden beri' },
  campaign: { label: 'Kampanyadan kayıt', hint: 'Bağlantılardaki kampanya adıyla gelen' },
  area: { label: 'Alandan kayıt', hint: 'Alanın bağlantılarından gelen' },
  custom: { label: 'Elle girilen', hint: 'Kulüp sayısı, görüşme gibi sayılar; sahibi günceller' },
};
const STATUS: Record<GrowthGoal['status'], { label: string; tone?: 'up' | 'yellow' | 'live' }> = {
  done: { label: 'Ulaşıldı', tone: 'up' },
  on: { label: 'Yetişiyor', tone: 'yellow' },
  behind: { label: 'Geride', tone: 'live' },
  late: { label: 'Süresi doldu', tone: 'live' },
};
const KIND: Record<Kind, { label: string; icon: 'check_circle' | 'event' | 'star'; cls: string }> = {
  done: { label: 'Yapıldı', icon: 'check_circle', cls: 'text-up' },
  plan: { label: 'Planlandı', icon: 'event', cls: 'text-sub' },
  milestone: { label: 'Dönüm noktası', icon: 'star', cls: 'text-yellow' },
};
const WEEK = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const dayLong = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
const shortDate = (d: string | Date) => new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
const one = (n: number | null) => (n === null ? '—' : n.toLocaleString('tr-TR', { maximumFractionDigits: 1 }));
const istDay = (d: string | Date) => new Date(new Date(d).getTime() + 3 * 3600 * 1000).toISOString().slice(0, 10);

// ─────────────────────────── Hedefler ───────────────────────────

function GoalEditor({ board, goal, onClose }: { board: GrowthBoard; goal: GrowthGoal | null; onClose: () => void }) {
  const refresh = useRefresh();
  const today = istDay(new Date());
  const [f, setF] = useState({
    title: goal?.title ?? '',
    metric: (goal?.metric ?? 'users') as Metric,
    target: goal ? String(goal.target) : '',
    startAt: goal ? istDay(goal.startAt) : today,
    dueAt: goal ? istDay(goal.dueAt) : '',
    campaign: goal?.campaign ?? '',
    areaId: goal?.areaId ?? '',
    ownerId: goal?.ownerId ?? '',
    current: goal?.metric === 'custom' ? String(goal.current) : '',
    note: goal?.note ?? '',
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const save = useMutation({
    mutationFn: () => {
      const body: GrowthGoalInput = {
        title: f.title,
        metric: f.metric,
        target: Number(f.target),
        startAt: `${f.startAt}T00:00:00+03:00`,
        dueAt: `${f.dueAt}T23:59:00+03:00`,
        campaign: f.metric === 'campaign' ? f.campaign : null,
        areaId: f.areaId || null,
        ownerId: f.ownerId || null,
        current: f.metric === 'custom' && f.current ? Number(f.current) : null,
        note: f.note || null,
      };
      return goal ? adminApi.growth.updateGoal(goal.id, body) : adminApi.growth.createGoal(body);
    },
    onSuccess: () => {
      toast(goal ? 'Hedef güncellendi' : 'Hedef eklendi');
      void refresh();
      onClose();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const ok =
    f.title.trim() && Number(f.target) > 0 && f.dueAt && (f.metric !== 'campaign' || f.campaign) && (f.metric !== 'area' || f.areaId);
  return (
    <Drawer
      open
      title={goal ? 'Hedefi düzenle' : 'Yeni hedef'}
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" busy={save.isPending} disabled={!ok} onClick={() => save.mutate()}>
            {goal ? 'Kaydet' : 'Hedefi ekle'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-[18px] py-4">
        <Field id="h-title" title="Hedef">
          <input
            id="h-title"
            className={input}
            value={f.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Kasım sonunda 200 kullanıcı"
            autoFocus
          />
        </Field>
        <Field id="h-metric" title="Neyle ölçülür" hint={METRIC[f.metric].hint}>
          <select id="h-metric" className={input} value={f.metric} onChange={(e) => set('metric', e.target.value as Metric)}>
            {(Object.keys(METRIC) as Metric[]).map((m) => (
              <option key={m} value={m}>
                {METRIC[m].label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="h-target" title="Hedef sayı">
            <input id="h-target" type="number" min={1} className={input} value={f.target} onChange={(e) => set('target', e.target.value)} />
          </Field>
          {f.metric === 'custom' && (
            <Field id="h-cur" title="Şu anki değer">
              <input
                id="h-cur"
                type="number"
                min={0}
                className={input}
                value={f.current}
                onChange={(e) => set('current', e.target.value)}
              />
            </Field>
          )}
          <Field id="h-start" title="Başlangıç">
            <input id="h-start" type="date" className={input} value={f.startAt} onChange={(e) => set('startAt', e.target.value)} />
          </Field>
          <Field id="h-due" title="Son gün">
            <input id="h-due" type="date" className={input} value={f.dueAt} onChange={(e) => set('dueAt', e.target.value)} />
          </Field>
          {f.metric === 'campaign' && (
            <Field id="h-camp" title="Kampanya">
              <input
                id="h-camp"
                className={input}
                value={f.campaign}
                onChange={(e) => set('campaign', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="ankara-kampus"
              />
            </Field>
          )}
          <Field id="h-area" title={f.metric === 'area' ? 'Alan' : 'Alan (isteğe bağlı)'}>
            <select id="h-area" className={input} value={f.areaId} onChange={(e) => set('areaId', e.target.value)}>
              <option value="">Alan yok</option>
              {board.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="h-owner" title="Sorumlu">
            <select id="h-owner" className={input} value={f.ownerId} onChange={(e) => set('ownerId', e.target.value)}>
              <option value="">Herkes</option>
              {teamOf(board).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName ?? p.username}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field id="h-note" title="Not">
          <textarea
            id="h-note"
            className={area_}
            value={f.note}
            onChange={(e) => set('note', e.target.value)}
            placeholder="Neden bu sayı, nasıl ulaşılacak"
          />
        </Field>
      </div>
    </Drawer>
  );
}

function GoalRow({ g, board, onEdit }: { g: GrowthGoal; board: GrowthBoard; onEdit: () => void }) {
  const refresh = useRefresh();
  const people = peopleMap(board.people);
  const area = board.areas.find((a) => a.id === g.areaId);
  const [val, setVal] = useState(String(g.current));
  const canUpdate = g.metric === 'custom' && (board.canManage || g.ownerId === board.meId);
  const update = useMutation({
    mutationFn: () => adminApi.growth.updateGoal(g.id, { current: Number(val) }),
    onSuccess: () => {
      toast('Değer güncellendi');
      void refresh();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const del = useMutation({
    mutationFn: () => adminApi.growth.deleteGoal(g.id),
    onSuccess: () => void refresh(),
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  // Çubuk başlangıç değerinden hedefe: toplam kullanıcı hedefinde baştaki kullanıcılar sayılmaz.
  const from = g.baseline ?? 0;
  const p = Math.max(0, Math.min(1, (g.current - from) / Math.max(1, g.target - from)));
  return (
    <div className="flex flex-col gap-2 px-[18px] py-3.5 shadow-[inset_0_0.5px_0_var(--color-line)]">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold">{g.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-sub">
            <span>{METRIC[g.metric].label}</span>
            {g.campaign && <Tag>#{g.campaign}</Tag>}
            {area && <Tag>{area.name}</Tag>}
            <span>
              · son gün {shortDate(g.dueAt)}
              {g.daysLeft > 0 ? `, ${g.daysLeft} gün kaldı` : ''}
            </span>
          </p>
        </div>
        {g.ownerId && <Who p={people.get(g.ownerId)} size={24} />}
        <Tag tone={STATUS[g.status].tone}>{STATUS[g.status].label}</Tag>
        {board.canManage && (
          <span className="flex">
            <IconButton icon="edit" label="Düzenle" size={19} onClick={onEdit} />
            <IconButton
              icon="delete"
              label="Sil"
              size={19}
              onClick={async () => {
                const c = await confirmAction({ title: 'Hedef silinsin mi?', body: g.title, ok: 'Sil', danger: true });
                if (c.ok) del.mutate();
              }}
            />
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="h-[8px] min-w-0 flex-1 overflow-hidden rounded-full bg-white/6">
          <div className={cn('h-full rounded-full', g.status === 'done' ? 'bg-up' : 'bg-yellow/85')} style={{ width: `${p * 100}%` }} />
        </div>
        <span className="text-[13px] whitespace-nowrap tabular">
          <b className="text-[15px]">{fmt(g.current)}</b> <span className="text-faint">/ {fmt(g.target)}</span>
        </span>
      </div>
      {g.status !== 'done' && (g.perDay !== null || g.needPerDay !== null) && (
        <p className="text-[12px] text-sub">
          {g.perDay !== null && <>Başlangıçtan beri günde {one(g.perDay)}. </>}
          {g.needPerDay !== null && <>Yetişmek için günde {one(g.needPerDay)} gerekiyor.</>}
        </p>
      )}
      {g.note && <p className="text-[12px] whitespace-pre-line text-faint">{g.note}</p>}
      {canUpdate && (
        <div className="flex items-center gap-2">
          <input
            aria-label="Ulaşılan değer"
            type="number"
            min={0}
            className={cn(input, 'h-8 w-[110px] text-[13px]')}
            value={val}
            onChange={(e) => setVal(e.target.value)}
          />
          <Button size="sm" busy={update.isPending} disabled={val === String(g.current) || val === ''} onClick={() => update.mutate()}>
            Değeri güncelle
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Gün ayrıntısı ───────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-[18px] pt-4">
      <h3 className="mb-2 text-[12.5px] font-semibold text-sub">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function DayDrawer({ day, cal, board, onClose }: { day: string; cal: Cal; board: GrowthBoard; onClose: () => void }) {
  const refresh = useRefresh();
  const people = peopleMap(board.people);
  const d = cal.days.find((x) => x.day === day);
  const events = cal.events.filter((e) => e.day === day);
  const done = cal.tasks.filter((t) => t.doneDay === day);
  const due = cal.tasks.filter((t) => t.dueDay === day && t.status !== 'done');
  const logs = cal.logs.filter((l) => l.day === day);
  const goals = cal.goals.filter((g) => istDay(g.dueAt) === day);
  const future = day > cal.today;
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [kind, setKind] = useState<Kind>(future ? 'plan' : 'done');
  const [areaId, setAreaId] = useState('');
  const add = useMutation({
    mutationFn: () => adminApi.growth.createEvent({ day, title, note: note || null, kind, areaId: areaId || null }),
    onSuccess: () => {
      toast('Takvime eklendi');
      setTitle('');
      setNote('');
      void refresh();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const del = useMutation({
    mutationFn: (id: string) => adminApi.growth.deleteEvent(id),
    onSuccess: () => void refresh(),
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  return (
    <Drawer open title={dayLong(day)} onClose={onClose}>
      {d && d.totalUsers !== null && (
        <div className="grid grid-cols-3 gap-2 px-[18px] pt-2">
          {[
            ['Toplam kullanıcı', d.totalUsers],
            ['Yeni kayıt', d.newUsers ?? 0],
            ['Kullanan', d.activeUsers ?? 0],
          ].map(([l, v]) => (
            <div key={l} className="rounded-option bg-elev2 px-3 py-2.5">
              <p className="text-[11.5px] text-sub">{l}</p>
              <p className="text-[20px] font-bold tabular">{fmt(Number(v))}</p>
            </div>
          ))}
        </div>
      )}
      {goals.length > 0 && (
        <Section title="Son günü bugün olan hedefler">
          {goals.map((g) => (
            <p key={g.id} className="flex items-center gap-2 text-[13.5px]">
              <Icon name="flag" size={17} className="text-yellow" />
              <span className="min-w-0 flex-1">{g.title}</span>
              <span className="tabular text-sub">
                {fmt(g.current)} / {fmt(g.target)}
              </span>
            </p>
          ))}
        </Section>
      )}
      <Section title="Takvim">
        {events.length === 0 && <p className="text-[13px] text-faint">Bu güne bir şey yazılmamış.</p>}
        {events.map((e) => {
          const mine = board.canManage || e.createdById === board.meId || e.ownerId === board.meId;
          return (
            <div key={e.id} className="flex items-start gap-2 rounded-option bg-elev2 px-3 py-2.5">
              <Icon name={KIND[e.kind].icon} size={18} className={cn('mt-0.5', KIND[e.kind].cls)} />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold">{e.title}</p>
                <p className="text-[11.5px] text-faint">
                  {KIND[e.kind].label}
                  {e.ownerId && people.get(e.ownerId) ? ` · ${people.get(e.ownerId)!.displayName ?? people.get(e.ownerId)!.username}` : ''}
                  {e.areaId && board.areas.find((a) => a.id === e.areaId) ? ` · ${board.areas.find((a) => a.id === e.areaId)!.name}` : ''}
                </p>
                {e.note && <p className="mt-1 text-[12.5px] whitespace-pre-line text-sub">{e.note}</p>}
              </div>
              {mine && <IconButton icon="delete" label="Sil" size={18} onClick={() => del.mutate(e.id)} />}
            </div>
          );
        })}
      </Section>
      {done.length > 0 && (
        <Section title="Biten görevler">
          {done.map((t) => (
            <p key={t.id} className="flex items-center gap-2 text-[13.5px]">
              <Icon name="task_alt" size={17} className="text-up" />
              <span className="min-w-0 flex-1">{t.title}</span>
              {t.assigneeId && (
                <span className="text-[12px] text-faint">
                  {people.get(t.assigneeId)?.displayName ?? people.get(t.assigneeId)?.username}
                </span>
              )}
            </p>
          ))}
        </Section>
      )}
      {due.length > 0 && (
        <Section title="Son günü bugün olan görevler">
          {due.map((t) => (
            <p key={t.id} className="flex items-center gap-2 text-[13.5px]">
              <Icon name="schedule" size={17} className={cn(day < cal.today ? 'text-live' : 'text-sub')} />
              <span className="min-w-0 flex-1">{t.title}</span>
              {t.assigneeId && (
                <span className="text-[12px] text-faint">
                  {people.get(t.assigneeId)?.displayName ?? people.get(t.assigneeId)?.username}
                </span>
              )}
            </p>
          ))}
        </Section>
      )}
      {logs.length > 0 && (
        <Section title="Günlükler">
          {logs.map((l) => (
            <div key={l.id} className="rounded-option bg-elev2 px-3 py-2.5">
              <p className="text-[12px] font-semibold">{people.get(l.userId)?.displayName ?? people.get(l.userId)?.username ?? '—'}</p>
              <p className="mt-0.5 text-[13px] whitespace-pre-line text-sub">{l.text}</p>
            </div>
          ))}
        </Section>
      )}
      <Section title="Takvime ekle">
        <form
          className="flex flex-col gap-2 pb-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) add.mutate();
          }}
        >
          <Segment items={(Object.keys(KIND) as Kind[]).map((k) => ({ key: k, label: KIND[k].label }))} value={kind} onChange={setKind} />
          <input
            aria-label="Başlık"
            className={input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={future ? 'Bilkent kulüpler günü standı' : 'ODTÜ yemekhanede 200 el ilanı'}
          />
          <select aria-label="Alan" className={input} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            <option value="">Alan yok</option>
            {board.areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <textarea
            aria-label="Not"
            className={area_}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ayrıntı (isteğe bağlı)"
          />
          <Button type="submit" variant="primary" busy={add.isPending} disabled={!title.trim()}>
            Ekle
          </Button>
        </form>
      </Section>
    </Drawer>
  );
}

// ─────────────────────────── Sayfa ───────────────────────────

/** Kompakt hedef kartı: başlık, durum, çubuk, sayı; tıklayınca ayrıntı. */
function GoalCard({ g, onOpen }: { g: GrowthGoal; onOpen: () => void }) {
  const from = g.baseline ?? 0;
  const p = Math.max(0, Math.min(1, (g.current - from) / Math.max(1, g.target - from)));
  return (
    <button
      type="button"
      onClick={onOpen}
      className="press flex w-[248px] flex-none flex-col gap-2 rounded-card bg-elev px-4 py-3 text-left shadow-[inset_0_0_0_0.5px_var(--color-line)] transition-shadow hover:shadow-[inset_0_0_0_0.5px_var(--color-line2)]"
    >
      <span className="flex items-start gap-2">
        <span className="line-clamp-2 min-w-0 flex-1 text-[13.5px] leading-snug font-semibold">{g.title}</span>
        <Tag tone={STATUS[g.status].tone}>{STATUS[g.status].label}</Tag>
      </span>
      <span className="flex items-baseline gap-1 tabular">
        <b className="text-[22px] leading-none tracking-[-0.5px]">{fmt(g.current)}</b>
        <span className="text-[13px] text-faint">/ {fmt(g.target)}</span>
      </span>
      <span className="h-[6px] overflow-hidden rounded-full bg-white/6">
        <span
          className={cn('block h-full rounded-full', g.status === 'done' ? 'bg-up' : 'bg-yellow/85')}
          style={{ width: `${p * 100}%` }}
        />
      </span>
      <span className="text-[11.5px] text-sub">
        {g.status === 'done'
          ? `Ulaşıldı · son gün ${shortDate(g.dueAt)}`
          : g.daysLeft > 0
            ? `${g.daysLeft} gün kaldı${g.needPerDay !== null ? ` · günde ${one(g.needPerDay)} gerekiyor` : ''}`
            : `Süre ${shortDate(g.dueAt)} doldu`}
      </span>
    </button>
  );
}

type Chip = { key: string; label: string; cls: string; icon?: 'check_circle' | 'event' | 'star' | 'flag' | 'schedule' | 'task_alt' };

export function GrowthCalendar() {
  const board = useBoard();
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [view, setView] = useState<'month' | 'gantt'>('month');
  const q = useQuery({ queryKey: [...KEY, 'calendar', month ?? 'now'], queryFn: () => adminApi.growth.calendar(month) });
  const [open, setOpen] = useState<string | null>(null);
  const [goalOpen, setGoalOpen] = useState<string | null>(null);
  const [taskOpen, setTaskOpen] = useState<string | null>(null);
  const [goalEdit, setGoalEdit] = useState<GrowthGoal | 'new' | null>(null);
  const [taskEdit, setTaskEdit] = useState<GrowthTask | null>(null);
  const c = q.data;
  const b = board.data;

  // Her gün için takvim kutucuğundaki satırlar: hedef son günü, olaylar, görev son günleri.
  const chips = useMemo(() => {
    const m = new Map<string, Chip[]>();
    if (!c) return m;
    const push = (d: string, x: Chip) => m.set(d, [...(m.get(d) ?? []), x]);
    for (const g of c.goals) push(istDay(g.dueAt), { key: `g${g.id}`, label: g.title, icon: 'flag', cls: 'bg-yellow/14 text-yellow' });
    for (const e of c.events)
      push(e.day, {
        key: `e${e.id}`,
        label: e.title,
        icon: KIND[e.kind].icon,
        cls: e.kind === 'done' ? 'bg-up/12 text-up' : e.kind === 'milestone' ? 'bg-yellow/10 text-yellow' : 'bg-white/7 text-text',
      });
    for (const t of c.tasks) {
      if (t.status === 'done' && t.doneDay)
        push(t.doneDay, { key: `d${t.id}`, label: t.title, icon: 'task_alt', cls: 'bg-up/8 text-up/80 line-through' });
      else if (t.dueDay && t.status !== 'dropped')
        push(t.dueDay, {
          key: `t${t.id}`,
          label: t.title,
          icon: 'schedule',
          cls: t.dueDay < c.today ? 'bg-live/12 text-live' : 'bg-elev3 text-sub',
        });
    }
    return m;
  }, [c]);

  if (q.isError || board.isError)
    return (
      <Card>
        <ErrorState error={q.error ?? board.error} retry={() => void Promise.all([q.refetch(), board.refetch()])} />
      </Card>
    );
  if (!c || !b)
    return (
      <Card>
        <Rows n={6} />
      </Card>
    );

  const days = c.days.map((d) => d.day);
  const stat = new Map(c.days.map((d) => [d.day, d]));
  const lead = (new Date(`${days[0]}T12:00:00Z`).getUTCDay() + 6) % 7;
  const trail = (7 - ((lead + days.length) % 7)) % 7;
  const people = peopleMap(b.people);
  const goal = c.goals.find((g) => g.id === goalOpen);
  const task = b.tasks.find((t) => t.id === taskOpen);
  const past = c.days.filter((d) => d.totalUsers !== null);
  const newSum = past.reduce((n, d) => n + (d.newUsers ?? 0), 0);

  // Gantt: üstte hedefler, sonra alan alan görevler ve o alanın takvim olayları.
  const groups: GanttGroup[] = [
    {
      key: 'goals',
      label: 'Hedefler',
      items: c.goals.map((g) => {
        const from = g.baseline ?? 0;
        return {
          id: g.id,
          label: g.title,
          start: istDay(g.startAt),
          end: istDay(g.dueAt),
          tone: g.status === 'done' ? ('goal-done' as const) : ('goal' as const),
          progress: Math.max(0, (g.current - from) / Math.max(1, g.target - from)),
          value: `${fmt(g.current)} / ${fmt(g.target)}`,
          meta: `${STATUS[g.status].label}${g.daysLeft > 0 ? ` · ${g.daysLeft} gün kaldı` : ''}`,
          onClick: () => setGoalOpen(g.id),
        };
      }),
    },
    ...[...b.areas, { id: '', name: 'Alansız' }].map((a) => ({
      key: a.id || 'none',
      label: a.name,
      items: [
        ...c.tasks
          .filter((t) => (t.areaId ?? '') === a.id)
          .sort((x, y) => x.startDay.localeCompare(y.startDay))
          .map((t) => ({
            id: t.id,
            label: t.title,
            start: [t.startDay, t.dueDay ?? t.startDay].sort()[0],
            end: t.dueDay ?? t.startDay,
            tone: taskTone(t, c.today),
            meta: [
              t.assigneeId ? (people.get(t.assigneeId)?.displayName ?? people.get(t.assigneeId)?.username) : 'Atanmamış',
              t.dueDay ? `son gün ${shortDate(t.dueDay)}` : null,
            ]
              .filter(Boolean)
              .join(' · '),
            onClick: () => setTaskOpen(t.id),
          })),
        ...c.events
          .filter((e) => (e.areaId ?? '') === a.id)
          .map((e) => ({
            id: e.id,
            label: e.title,
            start: e.day,
            end: e.day,
            tone: 'todo' as const,
            point: { icon: KIND[e.kind].icon, cls: KIND[e.kind].cls },
            meta: `${KIND[e.kind].label} · ${shortDate(e.day)}`,
            onClick: () => setOpen(e.day),
          })),
      ],
    })),
  ].map((g) => (g.key === 'none' ? { ...g, label: 'Genel' } : g));

  const upcoming = [...days.filter((d) => d >= c.today)].flatMap((d) =>
    (chips.get(d) ?? []).filter((x) => !x.key.startsWith('d')).map((x) => ({ ...x, day: d })),
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-[250px]">
          <Segment
            items={[
              { key: 'month', label: 'Takvim' },
              { key: 'gantt', label: 'Zaman çizelgesi' },
            ]}
            value={view}
            onChange={setView}
          />
        </div>
        <MonthNav month={c.month} current={c.today.slice(0, 7)} onChange={setMonth} />
        <span className="text-[12.5px] text-sub">
          {past.length ? `${fmt(past.at(-1)!.totalUsers ?? 0)} kullanıcı · bu ay ${fmt(newSum)} yeni` : 'Henüz gelmedi'}
        </span>
        {b.canManage && (
          <Button className="ml-auto" size="sm" variant="primary" icon="add" onClick={() => setGoalEdit('new')}>
            Yeni hedef
          </Button>
        )}
      </div>

      {c.goals.length > 0 ? (
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 md:-mx-6 md:px-6">
          {c.goals.map((g) => (
            <GoalCard key={g.id} g={g} onOpen={() => setGoalOpen(g.id)} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon="flag"
            title="Henüz hedef yok"
            body="Sayıyla ve tarihle: 30 Kasım'a kadar 200 kullanıcı, haftalık 100 aktif, 5 kulüple anlaşma."
          />
        </Card>
      )}

      {view === 'month' ? (
        <>
          <Card>
            <div className="grid grid-cols-7 border-b-[0.5px] border-line">
              {WEEK.map((w, i) => (
                <span key={w} className={cn('py-2 text-center text-[11.5px] font-semibold', i >= 5 ? 'text-faint' : 'text-sub')}>
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: lead }, (_, i) => (
                <span
                  key={`b${i}`}
                  className="min-h-[60px] border-r-[0.5px] border-b-[0.5px] border-line bg-white/[0.015] sm:min-h-[120px]"
                />
              ))}
              {days.map((d, i) => {
                const st = stat.get(d)!;
                const list = chips.get(d) ?? [];
                const isToday = d === c.today;
                const col = (lead + i) % 7;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setOpen(d)}
                    aria-label={`${dayLong(d)}${st.totalUsers !== null ? `, ${st.totalUsers} kullanıcı` : ''}${list.length ? `, ${list.length} kayıt` : ''}`}
                    className={cn(
                      'press flex min-h-[60px] min-w-0 flex-col gap-1 border-b-[0.5px] border-line p-1 text-left transition-colors hover:bg-white/[0.035] sm:min-h-[120px] sm:p-1.5',
                      col < 6 && 'border-r-[0.5px]',
                      col >= 5 && 'bg-white/[0.015]',
                    )}
                  >
                    <span className="flex items-center gap-1">
                      <span
                        className={cn(
                          'flex h-6 w-6 flex-none items-center justify-center rounded-full text-[12.5px] font-semibold tabular',
                          isToday ? 'bg-yellow text-black' : d > c.today ? 'text-faint' : 'text-text',
                        )}
                      >
                        {Number(d.slice(8))}
                      </span>
                      {st.totalUsers !== null && (
                        <span
                          className="ml-auto hidden text-[10.5px] text-faint tabular sm:inline"
                          title={`Gün sonunda ${st.totalUsers} kullanıcı, ${st.newUsers} yeni, ${st.activeUsers} kişi kullandı`}
                        >
                          {fmt(st.totalUsers)}
                          {!!st.newUsers && <span className="ml-0.5 font-semibold text-up">+{st.newUsers}</span>}
                        </span>
                      )}
                    </span>
                    {/* Geniş ekranda başlıklar, telefonda noktalar */}
                    <span className="hidden min-w-0 flex-col gap-[3px] sm:flex">
                      {list.slice(0, 3).map((x) => (
                        <span
                          key={x.key}
                          className={cn('flex min-w-0 items-center gap-1 rounded-[5px] px-1.5 py-[2px] text-[11px] font-medium', x.cls)}
                        >
                          {x.icon && <Icon name={x.icon} size={12} className="flex-none" />}
                          <span className="truncate">{x.label}</span>
                        </span>
                      ))}
                      {list.length > 3 && <span className="px-1.5 text-[10.5px] text-sub">+{list.length - 3} daha</span>}
                    </span>
                    {list.length > 0 && (
                      <span className="flex flex-wrap gap-[3px] px-0.5 sm:hidden">
                        {list.slice(0, 4).map((x) => (
                          <i
                            key={x.key}
                            className={cn(
                              'block h-[6px] w-[6px] rounded-full',
                              x.cls
                                .split(' ')
                                .find((k) => k.startsWith('text-'))!
                                .replace('text-', 'bg-'),
                            )}
                          />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
              {Array.from({ length: trail }, (_, i) => (
                <span
                  key={`a${i}`}
                  className={cn(
                    'min-h-[60px] border-b-[0.5px] border-line bg-white/[0.015] sm:min-h-[120px]',
                    i < trail - 1 && 'border-r-[0.5px]',
                  )}
                />
              ))}
            </div>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 px-[18px] py-3 text-[11.5px] text-sub">
              <span>Sağ üstte: gün sonundaki kullanıcı sayısı, yeşil: o gün gelen</span>
              <span className="flex items-center gap-1 text-up">
                <Icon name="check_circle" size={13} /> yapıldı
              </span>
              <span className="flex items-center gap-1">
                <Icon name="event" size={13} /> planlı
              </span>
              <span className="flex items-center gap-1 text-yellow">
                <Icon name="star" size={13} /> dönüm noktası
              </span>
              <span className="flex items-center gap-1 text-yellow">
                <Icon name="flag" size={13} /> hedef son günü
              </span>
              <span className="flex items-center gap-1">
                <Icon name="schedule" size={13} /> görev son günü
              </span>
            </p>
          </Card>

          {upcoming.length > 0 && (
            <Card title="Sırada" sub="bugünden ay sonuna">
              <div className="pb-1">
                {upcoming.map((u) => (
                  <button
                    key={`${u.day}-${u.key}`}
                    type="button"
                    onClick={() => setOpen(u.day)}
                    className="press flex w-full items-center gap-3 px-[18px] py-2.5 text-left shadow-[inset_0_0.5px_0_var(--color-line)] hover:bg-white/3"
                  >
                    <span className="w-[64px] flex-none text-[12.5px] font-semibold text-sub">{shortDate(u.day)}</span>
                    {u.icon && <Icon name={u.icon} size={17} className={u.cls.split(' ').find((k) => k.startsWith('text-'))} />}
                    <span className="min-w-0 flex-1 truncate text-[13.5px]">{u.label}</span>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <Gantt
            days={days}
            today={c.today}
            groups={groups}
            metric={{ label: 'Kullanıcı', value: (d) => (stat.get(d)?.totalUsers != null ? String(stat.get(d)!.totalUsers) : null) }}
            empty={<EmptyState icon="calendar_month" title="Bu ayda planlı bir şey yok" />}
          />
          <GanttLegend goals />
        </Card>
      )}

      {open && <DayDrawer day={open} cal={c} board={b} onClose={() => setOpen(null)} />}
      {goal && !goalEdit && (
        <Drawer open title="Hedef" onClose={() => setGoalOpen(null)}>
          <GoalRow
            g={goal}
            board={b}
            onEdit={() => {
              setGoalOpen(null);
              setGoalEdit(goal);
            }}
          />
        </Drawer>
      )}
      {task && !taskEdit && (
        <Drawer open title="Görev" onClose={() => setTaskOpen(null)}>
          <TaskRow
            t={task}
            board={b}
            canManage={b.canManage}
            onEdit={() => {
              setTaskOpen(null);
              setTaskEdit(task);
            }}
          />
        </Drawer>
      )}
      {taskEdit && <TaskEditor board={b} task={taskEdit} onClose={() => setTaskEdit(null)} />}
      {goalEdit && <GoalEditor board={b} goal={goalEdit === 'new' ? null : goalEdit} onClose={() => setGoalEdit(null)} />}
    </>
  );
}
