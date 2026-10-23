// Ekonomi: gelir (mavi tik abonelikleri), coin dolaşımı ve hareketleri,
// sticker basımı/yönetimi (+ ayrıntı sayfası), ikinci el pazar, merch ürünleri.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Avatar, Tick } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { DailyBars, HBars } from '@/components/ui/Chart';
import { Icon } from '@/components/ui/Icon';
import { Card, EmptyState, ErrorState, Rows, Stat, Tag } from '@/components/ui/misc';
import { Pills, Segment } from '@/components/ui/Tabs';
import {
  adminApi,
  type ListingStatus,
  mediaUrl,
  type Product,
  type Rarity,
  type StickerBody,
  type StickerDetail,
  type SubStatus,
} from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { compact, fmt, timeAgo } from '@/lib/format';
import { go, paths } from '@/lib/go';
import { playSound } from '@/lib/sound';
import { confirmAction, toast } from '@/stores/ui';
import { Field, field } from './Publish';

const DAYS = [
  { key: '7', label: '7 gün' },
  { key: '30', label: '30 gün' },
  { key: '90', label: '90 gün' },
] as const;
type Days = (typeof DAYS)[number]['key'];
const RARITY: Record<Rarity, [string, 'yellow' | 'blue' | 'epic' | undefined]> = {
  common: ['Sıradan', undefined],
  rare: ['Nadir', 'blue'],
  epic: ['Epik', 'epic'],
  legendary: ['Efsane', 'yellow'],
};
const REASON: Record<string, string> = {
  welcome: 'Hoş geldin ödülü',
  daily_post: 'Günlük gönderi',
  quiz_join: 'Quiz katılımı',
  quiz_rank: 'Quiz derecesi',
  sticker_buy: 'Mağazadan sticker',
  sticker_purchase: 'Pazardan alım',
  sticker_sale: 'Pazar satışı',
  admin: 'Yönetici düzeltmesi',
  activity_reward: 'Aktiflik ödülü',
};
const tl = (n: number) => `${fmt(n)} ₺`;

function useDone(msg: string, after?: () => void) {
  const qc = useQueryClient();
  return {
    onSuccess: () => {
      toast(msg);
      playSound('ok');
      qc.invalidateQueries({ queryKey: ['admin'] });
      after?.();
    },
    onError: (e: unknown) => toast(errorMessage(e), 'error'),
  };
}

function UserCell({
  u,
}: {
  u: { id: string; username: string; displayName: string | null; avatarPath: string | null; tick: 'none' | 'yellow' | 'blue' } | null;
}) {
  if (!u) return <span className="text-faint">—</span>;
  return (
    <button type="button" onClick={() => go(paths.user(u.id))} className="flex items-center gap-1.5 whitespace-nowrap hover:text-text">
      <Avatar src={u.avatarPath} name={u.displayName ?? u.username} size={22} />
      <span className="font-semibold">@{u.username}</span>
      <Tick tick={u.tick} size={11} />
    </button>
  );
}

function Loading({ q }: { q: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown } }) {
  if (q.isLoading)
    return (
      <Card>
        <Rows n={6} />
      </Card>
    );
  return (
    <Card>
      <ErrorState error={q.error} retry={() => q.refetch()} />
    </Card>
  );
}

// ---------------- Gelir ----------------
const SUB: Record<SubStatus, [string, 'up' | 'yellow' | 'live' | undefined]> = {
  active: ['Aktif', 'up'],
  pending_id: ['Kimlik bekliyor', 'yellow'],
  pending_review: ['İncelemede', 'yellow'],
  rejected: ['Reddedildi', 'live'],
  canceled: ['İptal', undefined],
  expired: ['Süresi doldu', undefined],
};

export function Revenue() {
  const [days, setDays] = useState<Days>('30');
  const [status, setStatus] = useState<SubStatus | 'all'>('active');
  const s = useQuery({ queryKey: ['admin', 'economy', days], queryFn: () => adminApi.economy(Number(days)) });
  const subs = useQuery({ queryKey: ['admin', 'economy', 'subs', status], queryFn: () => adminApi.subscriptions(status) });
  if (!s.data) return <Loading q={s} />;
  const d = s.data.subscriptions;
  return (
    <>
      <div className="flex justify-end">
        <div className="w-[260px]">
          <Segment value={days} onChange={setDays} items={DAYS.map((x) => ({ key: x.key, label: x.label }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat icon="toll" label="Aylık gelir (tahmini)" value={tl(d.monthlyRevenue)} sub="aktif aboneliklerin aylık karşılığı" />
        <Stat
          icon="verified"
          label="Aktif abone"
          value={fmt(d.active)}
          sub={`${fmt(d.newInPeriod)} yeni · ${fmt(d.canceledInPeriod)} iptal`}
          tone="up"
        />
        <Stat icon="schedule" label="İnceleme bekleyen" value={fmt(d.pendingReview)} onClick={() => go('/kullanicilar/tikler')} />
        <Stat
          icon="toll"
          label="Pazar komisyonu"
          value={`${fmt(s.data.market.commission)} coin`}
          sub={`${fmt(s.data.market.sold)} satış`}
        />
      </div>
      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card title="Abonelikler">
          <div className="px-[18px] pb-3">
            <Pills
              items={[
                { key: 'active', label: 'Aktif' },
                { key: 'pending_review', label: 'İncelemede' },
                { key: 'pending_id', label: 'Kimlik bekliyor' },
                { key: 'canceled', label: 'İptal' },
                { key: 'expired', label: 'Süresi dolan' },
                { key: 'all', label: 'Hepsi' },
              ]}
              value={status}
              onChange={setStatus}
            />
          </div>
          {subs.isLoading ? (
            <Rows />
          ) : !subs.data?.length ? (
            <EmptyState icon="verified" title="Kayıt yok" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="text-left text-[12px] text-faint">
                    <th className="px-[18px] py-2 font-semibold">Kullanıcı</th>
                    <th className="px-3 py-2 font-semibold">Plan</th>
                    <th className="px-3 py-2 font-semibold">Mağaza</th>
                    <th className="px-3 py-2 text-right font-semibold">Tutar</th>
                    <th className="px-3 py-2 font-semibold">Yenileme</th>
                    <th className="px-[18px] py-2 font-semibold">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.data.map((x) => (
                    <tr key={x.id} className="shadow-[inset_0_0.5px_0_var(--color-line)]">
                      <td className="px-[18px] py-2.5">
                        <UserCell u={x.user} />
                      </td>
                      <td className="px-3 py-2.5">{x.plan === 'yearly' ? 'Yıllık' : 'Aylık'}</td>
                      <td className="px-3 py-2.5">{x.store === 'apple' ? 'App Store' : x.store === 'google' ? 'Google Play' : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular">
                        {x.price ? `${fmt(x.price)} ${x.currency === 'TRY' ? '₺' : x.currency}` : '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-sub">
                        {x.renewsAt
                          ? new Date(x.renewsAt).toLocaleDateString('tr-TR')
                          : x.paidUntil
                            ? new Date(x.paidUntil).toLocaleDateString('tr-TR')
                            : '—'}
                      </td>
                      <td className="px-[18px] py-2.5">
                        <Tag tone={SUB[x.status][1]}>{SUB[x.status][0]}</Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <div className="flex flex-col gap-3.5">
          <Card title="Plan dağılımı">
            <div className="px-[18px] pb-5">
              {d.byPlan.length ? (
                <HBars rows={d.byPlan.map((p) => ({ key: p.plan, label: p.plan === 'yearly' ? 'Yıllık' : 'Aylık', value: p.count }))} />
              ) : (
                <p className="text-[13px] text-faint">Aktif abone yok</p>
              )}
            </div>
          </Card>
          <Card title="Mağaza dağılımı">
            <div className="px-[18px] pb-5">
              {d.byStore.length ? (
                <HBars
                  rows={d.byStore.map((p) => ({
                    key: p.store,
                    label: p.store === 'apple' ? 'App Store' : p.store === 'google' ? 'Google Play' : 'Ödemesiz / inceleme',
                    value: p.count,
                  }))}
                />
              ) : (
                <p className="text-[13px] text-faint">Aktif abone yok</p>
              )}
            </div>
          </Card>
          <Card>
            <p className="px-[18px] py-4 text-[12.5px] text-sub">
              Reklam geliri (AdSense) Google hesabı bağlanınca burada görünecek. Coin gerçek parayla satılmıyor; yalnız uygulama içi
              etkinlikle kazanılıyor.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}

// ---------------- Coin ----------------
export function Coins() {
  const [days, setDays] = useState<Days>('30');
  const [reason, setReason] = useState('');
  const s = useQuery({ queryKey: ['admin', 'economy', days], queryFn: () => adminApi.economy(Number(days)) });
  const led = useInfiniteQuery({
    queryKey: ['admin', 'economy', 'ledger', reason],
    queryFn: ({ pageParam }) => adminApi.ledger({ reason: reason || undefined, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  if (!s.data) return <Loading q={s} />;
  const c = s.data.coins;
  const rows = led.data?.pages.flatMap((p) => p.items) ?? [];
  const reasons = led.data?.pages[0]?.reasons ?? [];
  return (
    <>
      <div className="flex justify-end">
        <div className="w-[260px]">
          <Segment value={days} onChange={setDays} items={DAYS.map((x) => ({ key: x.key, label: x.label }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat icon="toll" label="Dolaşımdaki coin" value={compact(c.circulating)} sub={`${fmt(c.holders)} kişide`} />
        <Stat icon="trending_up" label="Kazanılan" value={compact(c.earned)} sub={`son ${days} gün`} tone="up" />
        <Stat icon="remove_circle" label="Harcanan" value={compact(c.spent)} sub={`son ${days} gün`} />
        <Stat
          icon="local_fire_department"
          label="Pazar hacmi"
          value={compact(s.data.market.volume)}
          sub={`${fmt(s.data.market.active)} aktif ilan`}
        />
      </div>
      <div className="grid items-start gap-3.5 lg:grid-cols-2">
        <Card title="Günlük kazanılan coin">
          <div className="px-[18px] pb-5">
            <DailyBars data={c.daily.map((x) => ({ day: x.day, value: x.earned }))} label="coin" />
          </div>
        </Card>
        <Card title="Nereden, nereye?" sub={`son ${days} gün`}>
          <div className="px-[18px] pb-5">
            {c.byReason.length ? (
              <HBars
                rows={c.byReason.map((r) => ({
                  key: r.reason,
                  label: REASON[r.reason] ?? r.reason,
                  value: r.amount,
                  hint: `${fmt(r.count)} işlem`,
                }))}
                format={(n) => (n > 0 ? `+${fmt(n)}` : `−${fmt(-n)}`)}
              />
            ) : (
              <p className="text-[13px] text-faint">Hareket yok</p>
            )}
          </div>
        </Card>
      </div>
      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card title="Hareketler">
          <div className="px-[18px] pb-3">
            <select className={cn(field, 'max-w-[260px]')} value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Tüm türler</option>
              {reasons.map((r) => (
                <option key={r} value={r}>
                  {REASON[r] ?? r}
                </option>
              ))}
            </select>
          </div>
          {led.isLoading ? (
            <Rows />
          ) : !rows.length ? (
            <EmptyState icon="toll" title="Hareket yok" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="shadow-[inset_0_0.5px_0_var(--color-line)]">
                      <td className="px-[18px] py-2.5">
                        <UserCell u={r.user} />
                      </td>
                      <td className="px-3 py-2.5 text-sub">{REASON[r.reason] ?? r.reason}</td>
                      <td className={cn('px-3 py-2.5 text-right font-semibold tabular', r.amount > 0 ? 'text-up' : 'text-live')}>
                        {r.amount > 0 ? `+${fmt(r.amount)}` : `−${fmt(-r.amount)}`}
                      </td>
                      <td className="px-3 py-2.5 text-right text-faint tabular">{fmt(r.balanceAfter)}</td>
                      <td className="px-[18px] py-2.5 text-right whitespace-nowrap text-faint">{timeAgo(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {led.hasNextPage && (
            <div className="flex justify-center p-4">
              <Button size="sm" variant="outline" busy={led.isFetchingNextPage} onClick={() => led.fetchNextPage()}>
                Daha fazla
              </Button>
            </div>
          )}
        </Card>
        <Card title="En zenginler">
          {c.top.map((u, i) => (
            <div key={u.id} className="flex items-center gap-3 px-[18px] py-2 shadow-[inset_0_0.5px_0_var(--color-line)]">
              <span className="w-5 text-center text-[12px] font-bold text-faint">{i + 1}</span>
              <div className="min-w-0 flex-1 text-[13px]">
                <UserCell u={u} />
              </div>
              <b className="text-[13px] tabular">{fmt(u.balance)}</b>
            </div>
          ))}
          <p className="px-[18px] py-3 text-[12px] text-faint">
            Tek kişiye coin eklemek / düşmek için profilindeki Yönetim sekmesini kullan.
          </p>
        </Card>
      </div>
    </>
  );
}

// ---------------- Sticker'lar ----------------
function ImageInput({
  value,
  onChange,
  prefix = 'sticker',
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  prefix?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const url = mediaUrl(value);
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="grid h-20 w-20 flex-none place-items-center overflow-hidden rounded-[14px] bg-elev2 text-sub shadow-[inset_0_0_0_0.5px_var(--color-line2)] hover:text-text"
      >
        {busy ? (
          <Icon name="progress_activity" size={22} className="animate-spin" />
        ) : url ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon name="add_circle" size={22} />
        )}
      </button>
      {value && (
        <Button size="xs" variant="ghost" type="button" onClick={() => onChange(null)}>
          Kaldır
        </Button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try {
            onChange((await adminApi.uploadImage(f, prefix)).url);
          } catch (err) {
            toast(errorMessage(err), 'error');
          } finally {
            setBusy(false);
            e.target.value = '';
          }
        }}
      />
    </div>
  );
}

const emptySticker: StickerBody = {
  name: '',
  rarity: 'common',
  basePrice: 100,
  mintTotal: 1000,
  imagePath: null,
  showTmdbId: null,
  showTitle: null,
};

function StickerForm({
  initial,
  submit,
  busy,
  label,
  minMint = 1,
}: {
  initial: StickerBody;
  submit: (b: StickerBody) => void;
  busy: boolean;
  label: string;
  minMint?: number;
}) {
  const [b, setB] = useState<StickerBody>(initial);
  return (
    <form
      className="flex flex-col gap-3.5 px-[18px] pb-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit({ ...b, name: b.name.trim(), showTmdbId: b.showTmdbId?.trim() || null, showTitle: b.showTitle?.trim() || null });
      }}
    >
      <div className="flex gap-4">
        <ImageInput value={b.imagePath ?? null} onChange={(v) => setB({ ...b, imagePath: v })} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Field label="Ad">
            <input
              className={field}
              value={b.name}
              onChange={(e) => setB({ ...b, name: e.target.value })}
              maxLength={80}
              placeholder="ör. Heisenberg şapkası"
            />
          </Field>
        </div>
      </div>
      <Field label="Nadirlik">
        <Segment
          value={b.rarity}
          onChange={(r) => setB({ ...b, rarity: r })}
          items={(Object.keys(RARITY) as Rarity[]).map((k) => ({ key: k, label: RARITY[k][0] }))}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Mağaza fiyatı (coin)">
          <input
            className={cn(field, 'tabular')}
            inputMode="numeric"
            value={b.basePrice}
            onChange={(e) => setB({ ...b, basePrice: Number(e.target.value.replace(/\D/g, '')) || 0 })}
          />
        </Field>
        <Field label="Toplam basım" hint={minMint > 1 ? `Dolaşımdakinden (${fmt(minMint)}) az olamaz` : 'Bu adet dolunca tükenir'}>
          <input
            className={cn(field, 'tabular')}
            inputMode="numeric"
            value={b.mintTotal}
            onChange={(e) => setB({ ...b, mintTotal: Number(e.target.value.replace(/\D/g, '')) || 0 })}
          />
        </Field>
        <Field label="Dizi (TMDB ID)" hint="İsteğe bağlı">
          <input
            className={field}
            value={b.showTmdbId ?? ''}
            onChange={(e) => setB({ ...b, showTmdbId: e.target.value })}
            inputMode="numeric"
          />
        </Field>
        <Field label="Dizi adı" hint="İsteğe bağlı">
          <input className={field} value={b.showTitle ?? ''} onChange={(e) => setB({ ...b, showTitle: e.target.value })} />
        </Field>
      </div>
      <Button type="submit" variant="primary" className="self-end" busy={busy} disabled={b.name.trim().length < 2 || b.mintTotal < minMint}>
        {label}
      </Button>
    </form>
  );
}

export function Stickers() {
  const q = useQuery({ queryKey: ['admin', 'stickers'], queryFn: adminApi.stickers });
  const [creating, setCreating] = useState(false);
  const [rarity, setRarity] = useState<Rarity | 'all'>('all');
  const nav = useNavigate();
  const create = useMutation({
    mutationFn: adminApi.createSticker,
    ...useDone('Sticker basıldı'),
    onSuccess: ({ id }) => {
      toast('Sticker basıldı');
      playSound('ok');
      nav(paths.sticker(id));
    },
  });
  const list = (q.data ?? []).filter((s) => rarity === 'all' || s.rarity === rarity);
  return (
    <>
      {creating && (
        <Card
          title="Yeni sticker"
          right={
            <Button size="xs" variant="ghost" onClick={() => setCreating(false)}>
              Vazgeç
            </Button>
          }
        >
          <StickerForm initial={emptySticker} submit={(b) => create.mutate(b)} busy={create.isPending} label="Bas" />
        </Card>
      )}
      <Card>
        <div className="flex flex-wrap items-center gap-2 px-[18px] py-3.5">
          <Pills
            items={[
              { key: 'all' as const, label: 'Hepsi' },
              ...(Object.keys(RARITY) as Rarity[]).map((k) => ({ key: k, label: RARITY[k][0] })),
            ]}
            value={rarity}
            onChange={setRarity}
          />
          {!creating && (
            <Button size="sm" variant="primary" icon="add_circle" className="ml-auto" onClick={() => setCreating(true)}>
              Yeni sticker
            </Button>
          )}
        </div>
        {q.isLoading ? (
          <Rows />
        ) : q.isError ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : !list.length ? (
          <EmptyState
            icon="toll"
            title="Sticker yok"
            body="İlk sticker'ı bas; mağazada satılır, quiz ödülü olarak verilebilir, pazarda el değiştirir."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 px-[18px] pb-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {list.map((s) => {
              const pct = s.mintTotal ? Math.round((s.circulating / s.mintTotal) * 100) : 0;
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => go(paths.sticker(s.id))}
                  className="press flex flex-col gap-2 rounded-[16px] bg-elev2 p-3 text-left shadow-[inset_0_0_0_0.5px_var(--color-line)] hover:shadow-[inset_0_0_0_0.5px_var(--color-line2)]"
                >
                  <div className="grid aspect-square place-items-center overflow-hidden rounded-[12px] bg-elev3">
                    {s.imagePath ? (
                      <img src={mediaUrl(s.imagePath) ?? ''} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Icon name="toll" size={32} className="text-faint" />
                    )}
                  </div>
                  <p className="truncate text-[13.5px] font-semibold">{s.name}</p>
                  <div className="flex items-center gap-1.5">
                    <Tag tone={RARITY[s.rarity][1]}>{RARITY[s.rarity][0]}</Tag>
                    <span className="text-[12px] text-sub tabular">{fmt(s.basePrice)} coin</span>
                  </div>
                  <div className="h-[5px] overflow-hidden rounded-full bg-white/6">
                    <div
                      className={cn('h-full rounded-full', pct >= 100 ? 'bg-live' : 'bg-yellow/80')}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <p className="text-[11.5px] text-faint tabular">
                    {fmt(s.circulating)}/{fmt(s.mintTotal)} basıldı · {fmt(s.owners)} sahip
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}

export function StickerPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['admin', 'stickers', id], queryFn: () => adminApi.sticker(id!), enabled: !!id });
  const [username, setUsername] = useState('');
  const edit = useMutation({ mutationFn: (b: Partial<StickerBody>) => adminApi.editSticker(id!, b), ...useDone('Kaydedildi') });
  const grant = useMutation({
    mutationFn: (note?: string) => adminApi.grantSticker(id!, username.trim(), note),
    ...useDone('Hediye edildi', () => setUsername('')),
  });
  const del = useMutation({
    mutationFn: () => adminApi.deleteSticker(id!),
    onSuccess: () => {
      toast('Silindi');
      nav('/ekonomi/sticker', { replace: true });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  if (!q.data) return <Loading q={q} />;
  const s: StickerDetail = q.data;
  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-3.5">
        <Card>
          <div className="flex flex-wrap items-center gap-4 px-[18px] py-5">
            <div className="grid h-24 w-24 flex-none place-items-center overflow-hidden rounded-[18px] bg-elev2">
              {s.imagePath ? (
                <img src={mediaUrl(s.imagePath) ?? ''} alt="" className="h-full w-full object-cover" />
              ) : (
                <Icon name="toll" size={36} className="text-faint" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[20px] font-bold tracking-[-0.3px]">{s.name}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Tag tone={RARITY[s.rarity][1]}>{RARITY[s.rarity][0]}</Tag>
                {s.showTitle && <Tag>{s.showTitle}</Tag>}
                <span className="text-[12px] text-faint">{timeAgo(s.createdAt)} basıldı</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px border-t-[0.5px] border-line bg-line sm:grid-cols-4">
            {[
              ['Basılan', `${fmt(s.circulating)}/${fmt(s.mintTotal)}`],
              ['Sahip', fmt(s.owners)],
              ['Aktif ilan', fmt(s.activeListings)],
              ['Taban fiyat', s.floorPrice ? `${fmt(s.floorPrice)} coin` : '—'],
            ].map(([k, v]) => (
              <div key={k} className="bg-elev px-[18px] py-3">
                <p className="text-[17px] font-bold tabular">{v}</p>
                <p className="text-[11.5px] text-faint">{k}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Satış geçmişi">
          {!s.trades.length ? (
            <EmptyState icon="toll" title="Henüz satış yok" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <tbody>
                  {s.trades.map((t) => (
                    <tr key={t.id} className="shadow-[inset_0_0.5px_0_var(--color-line)]">
                      <td className="px-[18px] py-2.5">
                        <UserCell u={t.seller} />
                      </td>
                      <td className="px-2 text-faint">→</td>
                      <td className="px-3 py-2.5">
                        <UserCell u={t.buyer} />
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular">{fmt(t.price)} coin</td>
                      <td className="px-[18px] py-2.5 text-right text-faint">{timeAgo(t.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Sahipler">
          {!s.holders.length ? (
            <EmptyState icon="person" title="Henüz sahibi yok" />
          ) : (
            s.holders.map((h) => (
              <div key={h.id} className="flex items-center gap-3 px-[18px] py-2 text-[13px] shadow-[inset_0_0.5px_0_var(--color-line)]">
                <UserCell u={h} />
                <span className="ml-auto text-faint tabular">{fmt(h.count)} adet</span>
              </div>
            ))
          )}
        </Card>
      </div>
      <div className="flex flex-col gap-3.5">
        <Card title="Hediye et" sub="basımdan bir adet">
          <form
            className="flex flex-col gap-2 px-[18px] pb-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const c = await confirmAction({
                title: `@${username.replace(/^@/, '')} kullanıcısına hediye edilsin mi?`,
                body: 'Basım adedinden düşer; kullanıcıya bildirim gider.',
                ok: 'Hediye et',
                note: 'optional',
              });
              if (c.ok) grant.mutate(c.note);
            }}
          >
            <input className={field} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@kullaniciadi" />
            <Button
              type="submit"
              size="sm"
              variant="primary"
              busy={grant.isPending}
              disabled={username.trim().length < 2 || s.circulating >= s.mintTotal}
            >
              Hediye et
            </Button>
            {s.circulating >= s.mintTotal && <p className="text-[12px] text-live">Basım tükendi; önce adedi artır.</p>}
          </form>
        </Card>
        <Card title="Düzenle">
          <StickerForm
            key={`${s.id}${s.basePrice}${s.mintTotal}${s.imagePath}`}
            initial={{
              name: s.name,
              rarity: s.rarity,
              basePrice: s.basePrice,
              mintTotal: s.mintTotal,
              imagePath: s.imagePath,
              showTmdbId: s.showTmdbId,
              showTitle: s.showTitle,
            }}
            submit={(b) => edit.mutate(b)}
            busy={edit.isPending}
            label="Kaydet"
            minMint={Math.max(1, s.circulating)}
          />
        </Card>
        {s.circulating === 0 && (
          <Button
            variant="danger"
            icon="remove_circle"
            busy={del.isPending}
            onClick={async () => {
              const c = await confirmAction({
                title: 'Sticker silinsin mi?',
                body: 'Henüz kimseye basılmadı; kalıcı silinir.',
                ok: 'Sil',
                danger: true,
              });
              if (c.ok) del.mutate();
            }}
          >
            Sticker'ı sil
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------- Pazar ----------------
export function Market() {
  const [status, setStatus] = useState<ListingStatus>('active');
  const q = useInfiniteQuery({
    queryKey: ['admin', 'listings', status],
    queryFn: ({ pageParam }) => adminApi.listings(status, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const cancel = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => adminApi.cancelListing(id, note),
    ...useDone('İlan kaldırıldı'),
  });
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <Card>
      <div className="px-[18px] py-3.5">
        <Pills
          items={[
            { key: 'active', label: 'Aktif' },
            { key: 'sold', label: 'Satıldı' },
            { key: 'cancelled', label: 'Kaldırıldı' },
          ]}
          value={status}
          onChange={setStatus}
        />
      </div>
      {q.isLoading ? (
        <Rows />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !rows.length ? (
        <EmptyState icon="toll" title="İlan yok" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-faint">
                <th className="px-[18px] py-2 font-semibold">Sticker</th>
                <th className="px-3 py-2 font-semibold">Satıcı</th>
                {status === 'sold' && <th className="px-3 py-2 font-semibold">Alıcı</th>}
                <th className="px-3 py-2 text-right font-semibold">Fiyat</th>
                <th className="px-3 py-2 text-right font-semibold">Mağaza fiyatına göre</th>
                <th className="px-[18px] py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const ratio = l.sticker.basePrice ? l.price / l.sticker.basePrice : 0;
                return (
                  <tr key={l.id} className="shadow-[inset_0_0.5px_0_var(--color-line)]">
                    <td className="px-[18px] py-2.5">
                      <button
                        type="button"
                        onClick={() => go(paths.sticker(l.sticker.id))}
                        className="flex items-center gap-2 hover:text-text"
                      >
                        <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-[8px] bg-elev2">
                          {l.sticker.imagePath ? (
                            <img src={mediaUrl(l.sticker.imagePath) ?? ''} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Icon name="toll" size={16} />
                          )}
                        </span>
                        <span className="font-semibold">{l.sticker.name}</span>
                        <Tag tone={RARITY[l.sticker.rarity][1]}>{RARITY[l.sticker.rarity][0]}</Tag>
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <UserCell u={l.seller} />
                    </td>
                    {status === 'sold' && (
                      <td className="px-3 py-2.5">
                        <UserCell u={l.buyer} />
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-right font-semibold tabular">{fmt(l.price)} coin</td>
                    <td className={cn('px-3 py-2.5 text-right tabular', ratio >= 5 ? 'font-semibold text-live' : 'text-sub')}>
                      {ratio ? `${ratio.toFixed(1)}×` : '—'}
                    </td>
                    <td className="px-[18px] py-2.5 text-right">
                      {status === 'active' ? (
                        <Button
                          size="xs"
                          variant="danger"
                          onClick={async () => {
                            const c = await confirmAction({
                              title: 'İlan kaldırılsın mı?',
                              body: 'Sticker satıcının envanterine döner, satıcıya bildirim gider.',
                              ok: 'Kaldır',
                              danger: true,
                              note: 'optional',
                            });
                            if (c.ok) cancel.mutate({ id: l.id, note: c.note });
                          }}
                        >
                          Kaldır
                        </Button>
                      ) : (
                        <span className="text-[12px] text-faint">{timeAgo(l.soldAt ?? l.createdAt)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {q.hasNextPage && (
        <div className="flex justify-center p-4">
          <Button size="sm" variant="outline" busy={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
            Daha fazla
          </Button>
        </div>
      )}
    </Card>
  );
}

// ---------------- Ürünler ----------------
type ProductDraft = { name: string; showTitle: string; price: string; sizes: string; shopierUrl: string; imagePaths: string[] };
const toDraft = (p?: Product): ProductDraft => ({
  name: p?.name ?? '',
  showTitle: p?.showTitle ?? '',
  price: p ? String(p.price) : '',
  sizes: p?.sizes.join(', ') ?? '',
  shopierUrl: p?.shopierUrl ?? '',
  imagePaths: p?.imagePaths ?? [],
});

function ProductForm({ p, onDone }: { p?: Product; onDone: () => void }) {
  const [d, setD] = useState<ProductDraft>(toDraft(p));
  const body = () => ({
    name: d.name.trim(),
    showTitle: d.showTitle.trim() || null,
    price: Number(d.price) || 0,
    sizes: d.sizes
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
    shopierUrl: d.shopierUrl.trim() || null,
    imagePaths: d.imagePaths,
  });
  const save = useMutation({
    mutationFn: async (): Promise<unknown> => (p ? adminApi.editProduct(p.id, body()) : adminApi.createProduct(body())),
    ...useDone(p ? 'Ürün güncellendi' : 'Ürün eklendi', onDone),
  });
  const validUrl = !d.shopierUrl.trim() || /^https:\/\/\S+$/.test(d.shopierUrl.trim());
  return (
    <form
      className="flex flex-col gap-3 px-[18px] pb-5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="flex flex-wrap gap-2">
        {d.imagePaths.map((u) => (
          <div key={u} className="relative h-20 w-20 overflow-hidden rounded-[12px] bg-elev3">
            <img src={mediaUrl(u) ?? ''} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label="Görseli kaldır"
              onClick={() => setD({ ...d, imagePaths: d.imagePaths.filter((x) => x !== u) })}
              className="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-black/70"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
        {d.imagePaths.length < 8 && (
          <ImageInput value={null} prefix="product" onChange={(v) => v && setD({ ...d, imagePaths: [...d.imagePaths, v] })} />
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ürün adı">
          <input className={field} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} maxLength={120} />
        </Field>
        <Field label="Dizi" hint="İsteğe bağlı">
          <input className={field} value={d.showTitle} onChange={(e) => setD({ ...d, showTitle: e.target.value })} maxLength={120} />
        </Field>
        <Field label="Fiyat (₺)">
          <input
            className={cn(field, 'tabular')}
            inputMode="numeric"
            value={d.price}
            onChange={(e) => setD({ ...d, price: e.target.value.replace(/\D/g, '') })}
          />
        </Field>
        <Field label="Bedenler" hint="Virgülle: S, M, L">
          <input className={field} value={d.sizes} onChange={(e) => setD({ ...d, sizes: e.target.value })} />
        </Field>
      </div>
      <Field label="Shopier bağlantısı" hint={validUrl ? 'Satın al butonu buraya gider' : 'https:// ile başlamalı'}>
        <input
          className={field}
          value={d.shopierUrl}
          onChange={(e) => setD({ ...d, shopierUrl: e.target.value })}
          placeholder="https://www.shopier.com/..."
        />
      </Field>
      <div className="flex gap-2 self-end">
        <Button type="button" variant="ghost" onClick={onDone}>
          Vazgeç
        </Button>
        <Button type="submit" variant="primary" busy={save.isPending} disabled={d.name.trim().length < 2 || !d.price || !validUrl}>
          {p ? 'Kaydet' : 'Ekle'}
        </Button>
      </div>
    </form>
  );
}

export function Products() {
  const q = useQuery({ queryKey: ['admin', 'products'], queryFn: adminApi.products });
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const del = useMutation({ mutationFn: (id: string) => adminApi.deleteProduct(id), ...useDone('Ürün silindi') });
  let body: ReactNode;
  if (q.isLoading) body = <Rows />;
  else if (q.isError) body = <ErrorState error={q.error} retry={() => q.refetch()} />;
  else if (!q.data?.length && editing !== 'new')
    body = <EmptyState icon="toll" title="Ürün yok" body="Tişört, kupa, poster… Satış Shopier üzerinden; burada vitrini yönetirsin." />;
  else
    body = (q.data ?? []).map((p) =>
      editing === p.id ? (
        <div key={p.id} className="pt-4 shadow-[inset_0_0.5px_0_var(--color-line)]">
          <ProductForm p={p} onDone={() => setEditing(null)} />
        </div>
      ) : (
        <div key={p.id} className="flex items-center gap-3 px-[18px] py-3 shadow-[inset_0_0.5px_0_var(--color-line)]">
          <span className="grid h-14 w-14 flex-none place-items-center overflow-hidden rounded-[12px] bg-elev2">
            {p.imagePaths[0] ? (
              <img src={mediaUrl(p.imagePaths[0]) ?? ''} alt="" className="h-full w-full object-cover" />
            ) : (
              <Icon name="toll" size={20} className="text-faint" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold">{p.name}</p>
            <p className="text-[12px] text-faint">
              {p.showTitle ? `${p.showTitle} · ` : ''}
              {p.sizes.length ? `${p.sizes.join(' · ')} · ` : ''}
              {p.shopierUrl ? 'Shopier bağlı' : 'bağlantı yok'}
            </p>
          </div>
          <b className="text-[14px] tabular">{tl(p.price)}</b>
          <Button size="xs" variant="outline" onClick={() => setEditing(p.id)}>
            Düzenle
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={async () => {
              const c = await confirmAction({
                title: `"${p.name}" silinsin mi?`,
                body: 'Uygulamadaki mağaza vitrininden kalkar.',
                ok: 'Sil',
                danger: true,
              });
              if (c.ok) del.mutate(p.id);
            }}
          >
            Sil
          </Button>
        </div>
      ),
    );
  return (
    <Card
      title="Ürünler"
      sub="Uygulamadaki mağaza vitrini"
      right={
        editing !== 'new' && (
          <Button size="sm" variant="primary" icon="add_circle" onClick={() => setEditing('new')}>
            Yeni ürün
          </Button>
        )
      }
    >
      {editing === 'new' && <ProductForm onDone={() => setEditing(null)} />}
      {body}
    </Card>
  );
}
