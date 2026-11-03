// Büyüme · Takvim ve hedefler: ay takvimi üzerinde her gün kaç kullanıcı vardı, kaç kişi geldi ve
// kullandı, o gün ne yapıldı (olay, biten görev, günlük), ileride ne planlı; üstte hedefler ve hız.
import { useMutation, useQuery } from '@tanstack/react-query';
import { type ReactNode, useMemo, useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, EmptyState, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { Drawer } from '@/components/ui/Overlays';
import { Segment } from '@/components/ui/Tabs';
import { adminApi, type GrowthCalendar as Cal, type GrowthBoard, type GrowthGoal, type GrowthGoalInput } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { fmt } from '@/lib/format';
import { confirmAction, toast } from '@/stores/ui';
import { area_, Field, input, KEY, peopleMap, teamOf, useBoard, useRefresh, Who } from './Growth';

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

const monthLabel = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
const dayLong = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
const shortDate = (d: string | Date) => new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
const shift = (m: string, by: number) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return d.toISOString().slice(0, 7);
};
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

export function GrowthCalendar() {
  const board = useBoard();
  const [month, setMonth] = useState<string | undefined>(undefined);
  const q = useQuery({ queryKey: [...KEY, 'calendar', month ?? 'now'], queryFn: () => adminApi.growth.calendar(month) });
  const [open, setOpen] = useState<string | null>(null);
  const [goalEdit, setGoalEdit] = useState<GrowthGoal | 'new' | null>(null);
  const c = q.data;
  const b = board.data;

  const byDay = useMemo(() => {
    const m = new Map<string, { events: Cal['events']; done: number; due: number; logs: number; goals: number }>();
    if (!c) return m;
    for (const d of c.days) m.set(d.day, { events: [], done: 0, due: 0, logs: 0, goals: 0 });
    for (const e of c.events) m.get(e.day)?.events.push(e);
    for (const t of c.tasks) {
      if (t.doneDay && m.has(t.doneDay)) m.get(t.doneDay)!.done += 1;
      if (t.dueDay && t.status !== 'done' && t.status !== 'dropped' && m.has(t.dueDay)) m.get(t.dueDay)!.due += 1;
    }
    for (const l of c.logs) if (m.has(l.day)) m.get(l.day)!.logs += 1;
    for (const g of c.goals) {
      const k = istDay(g.dueAt);
      if (m.has(k)) m.get(k)!.goals += 1;
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

  const past = c.days.filter((d) => d.totalUsers !== null);
  const first = past[0];
  const last = past.at(-1);
  const newSum = past.reduce((n, d) => n + (d.newUsers ?? 0), 0);
  const avgActive = past.length ? Math.round(past.reduce((n, d) => n + (d.activeUsers ?? 0), 0) / past.length) : 0;
  const lead = (new Date(`${c.days[0].day}T12:00:00Z`).getUTCDay() + 6) % 7;
  const upcoming = [
    ...c.events
      .filter((e) => e.day >= c.today && e.kind !== 'done')
      .map((e) => ({ day: e.day, title: e.title, icon: KIND[e.kind].icon, cls: KIND[e.kind].cls })),
    ...c.tasks
      .filter((t) => t.dueDay && t.dueDay >= c.today && t.status !== 'done' && t.status !== 'dropped')
      .map((t) => ({ day: t.dueDay!, title: t.title, icon: 'schedule' as const, cls: 'text-sub' })),
    ...c.goals
      .filter((g) => istDay(g.dueAt) >= c.today && istDay(g.dueAt).startsWith(c.month))
      .map((g) => ({ day: istDay(g.dueAt), title: `Hedef: ${g.title}`, icon: 'flag' as const, cls: 'text-yellow' })),
  ].sort((x, y) => x.day.localeCompare(y.day));

  return (
    <>
      <Card
        title="Hedefler"
        sub={c.goals.length ? `${c.goals.filter((g) => g.status === 'done').length} / ${c.goals.length} ulaşıldı` : undefined}
        right={
          b.canManage && (
            <Button size="sm" variant="primary" icon="add" onClick={() => setGoalEdit('new')}>
              Yeni hedef
            </Button>
          )
        }
      >
        {c.goals.length === 0 ? (
          <EmptyState
            icon="flag"
            title="Henüz hedef yok"
            body="Sayıyla ve tarihle: 30 Kasım'a kadar 200 kullanıcı, haftalık 100 aktif, 5 kulüple anlaşma."
          />
        ) : (
          <div className="pb-1">
            {c.goals.map((g) => (
              <GoalRow key={g.id} g={g} board={b} onEdit={() => setGoalEdit(g)} />
            ))}
          </div>
        )}
      </Card>

      <Card
        title={<span className="capitalize">{monthLabel(c.month)}</span>}
        sub={
          first && last
            ? `${fmt((first.totalUsers ?? 0) - (first.newUsers ?? 0))} → ${fmt(last.totalUsers ?? 0)} kullanıcı · ${fmt(newSum)} yeni · günde ortalama ${fmt(avgActive)} kişi kullandı`
            : 'henüz gelmedi'
        }
        right={
          <span className="flex items-center gap-1">
            <IconButton icon="chevron_left" label="Önceki ay" onClick={() => setMonth(shift(c.month, -1))} />
            {c.month !== c.today.slice(0, 7) && (
              <Button size="xs" variant="ghost" onClick={() => setMonth(undefined)}>
                Bugün
              </Button>
            )}
            <IconButton icon="chevron_right" label="Sonraki ay" onClick={() => setMonth(shift(c.month, 1))} />
          </span>
        }
      >
        <div className="px-2 pb-3 sm:px-[18px] sm:pb-4">
          <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[11.5px] font-semibold text-faint">
            {WEEK.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: lead }, (_, i) => (
              <span key={`b${i}`} />
            ))}
            {c.days.map((d) => {
              const x = byDay.get(d.day)!;
              const isToday = d.day === c.today;
              const future = d.day > c.today;
              return (
                <button
                  key={d.day}
                  type="button"
                  onClick={() => setOpen(d.day)}
                  aria-label={`${dayLong(d.day)}${d.totalUsers !== null ? `, ${d.totalUsers} kullanıcı, ${d.newUsers} yeni` : ''}`}
                  className={cn(
                    'press flex min-h-[64px] min-w-0 flex-col items-stretch gap-0.5 rounded-[10px] p-1.5 text-left transition-colors sm:min-h-[96px] sm:p-2',
                    future ? 'bg-white/[0.02] hover:bg-white/5' : 'bg-elev2 hover:bg-elev3',
                    isToday && 'shadow-[inset_0_0_0_1.5px_var(--color-yellow)]',
                  )}
                >
                  <span className={cn('text-[12px] font-semibold', isToday ? 'text-yellow' : future ? 'text-faint' : 'text-sub')}>
                    {Number(d.day.slice(8))}
                  </span>
                  {d.totalUsers !== null && (
                    <span className="flex flex-wrap items-baseline gap-x-1">
                      <b className="text-[13px] tabular sm:text-[16px]">{fmt(d.totalUsers)}</b>
                      {!!d.newUsers && <span className="text-[11px] font-semibold text-yellow tabular">+{d.newUsers}</span>}
                    </span>
                  )}
                  {d.activeUsers !== null && <span className="hidden text-[11px] text-faint sm:block">{fmt(d.activeUsers)} kullandı</span>}
                  <span className="mt-auto flex flex-wrap items-center gap-0.5">
                    {x.events.map((e) => (
                      <Icon key={e.id} name={KIND[e.kind].icon} size={14} className={KIND[e.kind].cls} />
                    ))}
                    {x.goals > 0 && <Icon name="flag" size={14} className="text-yellow" />}
                    {x.done > 0 && <Icon name="task_alt" size={14} className="text-up" />}
                    {x.due > 0 && <Icon name="schedule" size={14} className={cn(d.day < c.today ? 'text-live' : 'text-sub')} />}
                    {x.logs > 0 && (
                      <span className="hidden items-center text-[10.5px] text-faint sm:flex">
                        <Icon name="edit_note" size={14} />
                        {x.logs}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-faint">
            <span>Sayı: o günün sonunda toplam kullanıcı, sarı: o gün gelen</span>
            <span className="flex items-center gap-1">
              <Icon name="check_circle" size={13} className="text-up" /> yapıldı
            </span>
            <span className="flex items-center gap-1">
              <Icon name="event" size={13} /> planlı
            </span>
            <span className="flex items-center gap-1">
              <Icon name="star" size={13} className="text-yellow" /> dönüm noktası
            </span>
            <span className="flex items-center gap-1">
              <Icon name="flag" size={13} className="text-yellow" /> hedefin son günü
            </span>
            <span className="flex items-center gap-1">
              <Icon name="schedule" size={13} /> görev son günü
            </span>
          </p>
        </div>
      </Card>

      {upcoming.length > 0 && (
        <Card title="Bu ay sırada" sub="planlananlar, görev ve hedef son günleri">
          <div className="pb-1">
            {upcoming.map((u, i) => (
              <button
                key={`${u.day}-${i}`}
                type="button"
                onClick={() => setOpen(u.day)}
                className="press flex w-full items-center gap-3 px-[18px] py-2.5 text-left shadow-[inset_0_0.5px_0_var(--color-line)] hover:bg-white/3"
              >
                <span className="w-[64px] flex-none text-[12.5px] font-semibold text-sub">{shortDate(u.day)}</span>
                <Icon name={u.icon} size={17} className={u.cls} />
                <span className="min-w-0 flex-1 truncate text-[13.5px]">{u.title}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {open && <DayDrawer day={open} cal={c} board={b} onClose={() => setOpen(null)} />}
      {goalEdit && <GoalEditor board={b} goal={goalEdit === 'new' ? null : goalEdit} onClose={() => setGoalEdit(null)} />}
    </>
  );
}
