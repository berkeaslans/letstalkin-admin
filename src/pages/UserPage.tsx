import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { Avatar, Tick } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, EmptyState, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { Switch } from '@/components/ui/Switch';
import { Pills, Segment } from '@/components/ui/Tabs';
import { type AdminNote, adminApi, type Role, type Tick as TickKind, type UserDetail } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { compact, fmt, timeAgo } from '@/lib/format';
import { go, paths } from '@/lib/go';
import { playSound } from '@/lib/sound';
import { useIsAdmin, useSession } from '@/stores/session';
import { confirmAction, toast } from '@/stores/ui';
import { AuditList } from './Audit';
import { AccountTab, ContentTab, DeletionBanner, ProfileTab, RelationsTab } from './UserTabs';

/** Kullanıcının ayrıntı sayfasına gider (/kullanicilar/:id). */
export const openUser = (id: string) => go(paths.user(id));

export const ACCOUNT: Record<UserDetail['accountType'], string> = {
  person: 'Bireysel',
  fan: 'Fan sayfası',
  official: 'Resmi sayfa',
  sponsor: 'Sponsor',
};
const ROLE: Record<Role, string> = { user: 'Kullanıcı', moderator: 'Moderatör', admin: 'Admin' };
const SOURCE: Record<UserDetail['tickSource'], string> = {
  manual: 'Elle verildi',
  official: 'Resmi dizi sayfası onayından geliyor',
  blue: 'Mavi tik aboneliğinden geliyor',
  none: 'Resmi sayfası ve doğrulaması yok',
};

const field =
  'h-11 w-full rounded-option bg-elev2 px-3.5 text-[14px] outline-none shadow-[inset_0_0_0_0.5px_var(--color-line2)] placeholder:text-faint focus:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.32)]';

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] font-semibold text-sub">{children}</p>;
}

const TABS = ['manage', 'profile', 'account', 'content', 'relations', 'reports', 'notes', 'history'] as const;
type TabKey = (typeof TABS)[number];

export function UserPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ['admin', 'user', id], queryFn: () => adminApi.user(id!), enabled: !!id });
  if (q.isLoading)
    return (
      <Card>
        <Rows n={8} />
      </Card>
    );
  if (q.isError)
    return (
      <Card>
        <ErrorState error={q.error} retry={() => q.refetch()} />
      </Card>
    );
  return q.data ? <Body u={q.data} /> : null;
}

function Body({ u }: { u: UserDetail }) {
  const [params, setParams] = useSearchParams();
  const notes = useQuery({ queryKey: ['admin', 'notes', u.id], queryFn: () => adminApi.notes(u.id) });
  const pinned = (notes.data ?? []).filter((n) => n.pinned);
  const tab: TabKey = (TABS as readonly string[]).includes(params.get('sekme') ?? '') ? (params.get('sekme') as TabKey) : 'manage';
  const setTab = (t: TabKey) => setParams(t === 'manage' ? {} : { sekme: t }, { replace: true });
  if (u.deletion)
    return (
      <Card>
        <DeletionBanner u={u} />
      </Card>
    );
  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-[340px_minmax(0,1fr)]">
      {!!pinned.length && (
        <div className="flex flex-col gap-2 rounded-card bg-live/10 px-[18px] py-3.5 shadow-[inset_0_0_0_0.5px_rgb(255_59_78/0.3)] lg:col-span-2">
          {pinned.map((n) => (
            <div key={n.id} className="flex items-start gap-2.5 text-[13.5px]">
              <Icon name="error" size={18} className="mt-px flex-none text-live" />
              <p className="min-w-0 flex-1 break-words whitespace-pre-line">
                {n.text}
                <span className="ml-1.5 text-[11.5px] text-faint">
                  — @{n.author?.username ?? 'ekip'} · {timeAgo(n.createdAt)}
                </span>
              </p>
            </div>
          ))}
        </div>
      )}
      <Card className="lg:sticky lg:top-[76px]">
        <div className="flex flex-col items-center gap-2 px-[18px] pt-6 pb-4 text-center">
          <Avatar src={u.avatarPath} name={u.displayName ?? u.username} size={84} />
          <p className="mt-1 flex items-center gap-1.5 text-[20px] font-bold tracking-[-0.3px]">
            {u.displayName ?? u.username}
            <Tick tick={u.tick} size={18} />
          </p>
          <p className="-mt-1 text-[13.5px] text-sub">@{u.username}</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {u.role !== 'user' && <Tag tone={u.role === 'admin' ? 'yellow' : 'blue'}>{ROLE[u.role]}</Tag>}
            {u.isBanned ? <Tag tone="live">Banlı</Tag> : <Tag tone="up">Aktif</Tag>}
            <Tag>{ACCOUNT[u.accountType]}</Tag>
            {u.isTrusted && <Tag tone="blue">Güvenilir</Tag>}
          </div>
        </div>
        <div className="mx-[18px] mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] bg-line">
          {[
            ['Takipçi', compact(u.followerCount)],
            ['Gönderi', fmt(u.postCount)],
            ['Coin', fmt(u.balance)],
            ['Şikayet', fmt(u.reportCount)],
          ].map(([k, v]) => (
            <div key={k} className="bg-elev2 px-3 py-2.5">
              <p className="text-[17px] font-bold tabular">{v}</p>
              <p className="text-[11.5px] text-faint">{k}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-px border-t-[0.5px] border-line py-2 text-[13px]">
          {[
            ['Katılım', new Date(u.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })],
            ['Son aktiflik', timeAgo(u.lastActiveAt)],
            ...(u.email ? [['E-posta', `${u.email}${u.emailVerified ? '' : ' · doğrulanmadı'}`]] : []),
          ].map(([k, v]) => (
            <div key={k} className="flex items-center gap-3 px-[18px] py-1.5">
              <span className="text-sub">{k}</span>
              <span className="ml-auto min-w-0 truncate">{v}</span>
            </div>
          ))}
        </div>
        <p className="flex items-center gap-1.5 border-t-[0.5px] border-line px-[18px] py-3 text-[12px] text-faint">
          <Icon name="history" size={15} />
          Her değişiklik denetim kaydına yazılır
        </p>
      </Card>

      <Card>
        <div className="no-scrollbar overflow-x-auto px-[18px] py-3.5">
          <Pills
            items={[
              { key: 'manage', label: 'Yönetim' },
              { key: 'profile', label: 'Profil' },
              { key: 'account', label: 'Hesap' },
              { key: 'content', label: 'İçerik' },
              { key: 'relations', label: 'Bağlantılar' },
              { key: 'reports', label: 'Şikayetler', count: u.reports.length },
              { key: 'notes', label: 'Notlar', count: notes.data?.length },
              { key: 'history', label: 'Geçmiş', count: u.history.length },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
        <div key={tab} className="page-in">
          {tab === 'manage' && <Manage u={u} />}
          {tab === 'profile' && <ProfileTab u={u} />}
          {tab === 'account' && <AccountTab u={u} />}
          {tab === 'content' && <ContentTab u={u} />}
          {tab === 'relations' && <RelationsTab u={u} />}
          {tab === 'reports' &&
            (u.reports.length ? (
              u.reports.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-[18px] py-3 text-[13px] shadow-[inset_0_0.5px_0_var(--color-line)]">
                  <Icon name="crisis_alert" size={18} filled className="text-live" />
                  <span className="flex-1">{r.reason}</span>
                  <Tag tone={r.status === 'new' ? 'live' : undefined}>{r.status === 'new' ? 'Bekliyor' : 'Kapandı'}</Tag>
                  <span className="text-[11.5px] text-faint">{timeAgo(r.createdAt)}</span>
                </div>
              ))
            ) : (
              <EmptyState icon="workspace_premium" title="Temiz sicil" body="Bu hesap hakkında şikayet yok." />
            ))}
          {tab === 'notes' && <NotesTab userId={u.id} />}
          {tab === 'history' && <AuditList items={u.history} compact />}
        </div>
      </Card>
    </div>
  );
}

function Manage({ u }: { u: UserDetail }) {
  const isAdmin = useIsAdmin();
  const meId = useSession((s) => s.me?.id);
  const self = meId === u.id;
  const qc = useQueryClient();
  const [tickNote, setTickNote] = useState('');
  const [coin, setCoin] = useState({ dir: 1, amount: '', note: '' });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'user', u.id] });
    qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    qc.invalidateQueries({ queryKey: ['admin', 'audit'] });
  };
  const fail = (e: unknown) => toast(errorMessage(e), 'error');

  const tick = useMutation({
    mutationFn: (t: TickKind | null) => adminApi.setTick(u.id, t, tickNote),
    onSuccess: (_, t) => {
      toast(
        t === null ? 'Otomatik hesaba dönüldü' : t === 'none' ? 'Tik kaldırıldı' : `${t === 'yellow' ? 'Sarı' : 'Mavi'} tik verildi`,
        'success',
        t ? 'Elle verildi; otomatik akışlar bunu silemez' : undefined,
      );
      playSound('ok');
      setTickNote('');
      refresh();
    },
    onError: fail,
  });
  const role = useMutation({
    mutationFn: ({ r, note }: { r: Role; note: string }) => adminApi.setRole(u.id, r, note),
    onSuccess: (_, { r }) => {
      toast(`Rol: ${ROLE[r]}`);
      playSound('ok');
      refresh();
    },
    onError: fail,
  });
  const ban = useMutation({
    mutationFn: ({ b, note }: { b: boolean; note: string }) => adminApi.setBan(u.id, b, note),
    onSuccess: (_, { b }) => {
      toast(b ? 'Kullanıcı banlandı' : 'Ban kaldırıldı', b ? 'alert' : 'success');
      playSound(b ? 'warn' : 'ok');
      refresh();
    },
    onError: fail,
  });
  const balance = useMutation({
    mutationFn: () => adminApi.adjustBalance(u.id, coin.dir * Number(coin.amount), coin.note.trim()),
    onSuccess: (r) => {
      toast(`${coin.dir > 0 ? '+' : '−'}${fmt(Number(coin.amount))} coin`, 'success', `Yeni bakiye ${fmt(r.balance)}`);
      playSound('ok');
      setCoin({ dir: 1, amount: '', note: '' });
      refresh();
    },
    onError: fail,
  });

  const current = u.tickManual ?? u.tick;
  const canBan = u.role === 'user' && !self;
  const amount = Number(coin.amount);

  return (
    <div className="flex flex-col gap-6 px-[18px] pt-1 pb-6">
      <div className="flex flex-col gap-2">
        <Label>Tik</Label>
        <Segment
          disabled={!isAdmin || tick.isPending}
          value={current}
          onChange={(t) => tick.mutate(t)}
          items={[
            { key: 'none', label: 'Yok' },
            {
              key: 'yellow',
              label: (
                <>
                  <Tick tick="yellow" size={14} />
                  Sarı
                </>
              ),
            },
            {
              key: 'blue',
              label: (
                <>
                  <Tick tick="blue" size={14} />
                  Mavi
                </>
              ),
            },
          ]}
        />
        <div className="flex items-start gap-2.5 rounded-[12px] bg-elev2 px-3 py-2.5">
          <Icon name={u.tickSource === 'manual' ? 'admin_panel_settings' : 'info'} size={18} className="mt-px text-sub" />
          <div className="min-w-0 text-[12.5px]">
            <p className="font-semibold">{u.tickSource === 'manual' ? 'Elle verildi' : u.tickSource === 'none' ? 'Tik yok' : 'Otomatik'}</p>
            <p className="text-sub">
              {u.tickSource === 'manual'
                ? `@${u.tickManualBy?.username ?? '?'} · ${timeAgo(u.tickManualAt)}${u.tickManualNote ? ` · "${u.tickManualNote}"` : ''}`
                : SOURCE[u.tickSource]}
            </p>
          </div>
        </div>
        {isAdmin ? (
          <>
            <input
              className={field}
              placeholder="Gerekçe — tik seçmeden önce yaz (denetim kaydına yazılır)"
              value={tickNote}
              onChange={(e) => setTickNote(e.target.value)}
              maxLength={300}
            />
            {u.tickManual && (
              <Button size="sm" variant="outline" className="self-start" busy={tick.isPending} onClick={() => tick.mutate(null)}>
                Elle verileni kaldır, otomatiğe dön
              </Button>
            )}
          </>
        ) : (
          <p className="text-[12px] text-faint">Tiki yalnız admin değiştirebilir.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label>Rol</Label>
        <Segment
          disabled={!isAdmin || self || role.isPending}
          value={u.role}
          onChange={async (r) => {
            const c = await confirmAction({
              title: `@${u.username} ${ROLE[r].toLowerCase()} olsun mu?`,
              body:
                r === 'admin'
                  ? 'Admin tik verebilir, rol değiştirebilir, coin düzeltebilir ve özellik bayraklarını yönetebilir.'
                  : r === 'moderator'
                    ? 'Moderatör şikayetlere karar verebilir, içerik kaldırabilir ve ban atabilir.'
                    : 'Tüm yönetim yetkileri alınır.',
              ok: 'Rolü değiştir',
              note: 'optional',
            });
            if (c.ok) role.mutate({ r, note: c.note });
          }}
          items={(['user', 'moderator', 'admin'] as const).map((k) => ({ key: k, label: ROLE[k] }))}
        />
        {self && <p className="text-[12px] text-faint">Kendi rolünü değiştiremezsin.</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label>Hesap</Label>
        <div className="flex flex-wrap gap-2">
          {u.isBanned ? (
            <Button size="sm" icon="lock" busy={ban.isPending} onClick={() => ban.mutate({ b: false, note: '' })}>
              Banı kaldır
            </Button>
          ) : (
            <Button
              size="sm"
              variant="danger"
              icon="block"
              disabled={!canBan}
              busy={ban.isPending}
              onClick={async () => {
                const c = await confirmAction({
                  title: `@${u.username} banlansın mı?`,
                  body: 'Tüm oturumları kapanır, içerikleri gizlenir ve giriş yapamaz.',
                  ok: 'Banla',
                  danger: true,
                  note: 'optional',
                });
                if (c.ok) ban.mutate({ b: true, note: c.note });
              }}
            >
              Banla
            </Button>
          )}
        </div>
        {!canBan && !u.isBanned && (
          <p className="text-[12px] text-faint">{self ? 'Kendini banlayamazsın.' : 'Yetkili hesaplar banlanamaz; önce rolü düşür.'}</p>
        )}
      </div>

      {isAdmin && (
        <div className="flex flex-col gap-2">
          <Label>Coin düzelt</Label>
          <div className="flex gap-2">
            <div className="w-[150px] flex-none">
              <Segment
                value={coin.dir === 1 ? 'add' : 'sub'}
                onChange={(k) => setCoin({ ...coin, dir: k === 'add' ? 1 : -1 })}
                items={[
                  { key: 'add', label: 'Ekle' },
                  { key: 'sub', label: 'Düş' },
                ]}
              />
            </div>
            <input
              className={cn(field, 'tabular')}
              inputMode="numeric"
              placeholder="Tutar"
              value={coin.amount}
              onChange={(e) => setCoin({ ...coin, amount: e.target.value.replace(/\D/g, '') })}
            />
          </div>
          <input
            className={field}
            placeholder="Gerekçe (zorunlu)"
            value={coin.note}
            onChange={(e) => setCoin({ ...coin, note: e.target.value })}
            maxLength={300}
          />
          <Button
            size="sm"
            variant="primary"
            icon="toll"
            className="self-start"
            busy={balance.isPending}
            disabled={!amount || coin.note.trim().length < 3 || (coin.dir < 0 && amount > u.balance)}
            onClick={() => balance.mutate()}
          >
            Uygula
          </Button>
          {coin.dir < 0 && amount > u.balance && <p className="text-[12px] text-live">Bakiye {fmt(u.balance)} coin; eksiye düşemez.</p>}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label>Bilgiler</Label>
        <div className="overflow-hidden rounded-[14px] bg-elev2">
          {[
            ['Hesap türü', ACCOUNT[u.accountType]],
            ...(u.email ? [['E-posta', `${u.email}${u.emailVerified ? '' : ' (doğrulanmadı)'}`]] : []),
            ['Ülke', u.country ?? '—'],
            ['Katılım', new Date(u.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })],
            ['Son aktiflik', timeAgo(u.lastActiveAt)],
            ['Güvenilir hesap', u.isTrusted ? 'Evet' : 'Hayır'],
            ['Mavi tik aboneliği', u.isBlueVerified ? 'Aktif' : 'Yok'],
            ['Kimlik', u.id],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center gap-3 px-3.5 py-2.5 shadow-[inset_0_-0.5px_0_var(--color-line)]">
              <span className="text-[13px] text-sub">{k}</span>
              <span className="ml-auto min-w-0 truncate text-[13.5px]">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Ekip notları: panelde kalır, kullanıcı asla göremez. */
function NotesTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [pin, setPin] = useState(false);
  const q = useQuery({ queryKey: ['admin', 'notes', userId], queryFn: () => adminApi.notes(userId) });
  const me = useSession((s) => s.me);
  const isAdmin = useIsAdmin();
  const after = (rows: AdminNote[]) => {
    qc.setQueryData(['admin', 'notes', userId], rows);
    qc.invalidateQueries({ queryKey: ['admin', 'audit'] });
  };
  const add = useMutation({
    mutationFn: () => adminApi.addNote(userId, text.trim(), pin),
    onSuccess: (rows) => {
      toast('Not eklendi');
      playSound('ok');
      setText('');
      setPin(false);
      after(rows);
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const del = useMutation({
    mutationFn: (id: string) => adminApi.removeNote(userId, id),
    onSuccess: (rows) => {
      toast('Not silindi');
      after(rows);
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const rows = q.data ?? [];
  return (
    <div className="flex flex-col gap-3 px-[18px] pt-1 pb-5">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <textarea
          className="min-h-[76px] w-full resize-y rounded-[14px] bg-elev2 px-3.5 py-2.5 text-[14px] outline-none shadow-[inset_0_0_0_0.5px_var(--color-line2)] placeholder:text-faint focus:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.32)]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ekip için not: ne oldu, ne konuşuldu, neye dikkat edilmeli…"
          maxLength={2000}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Switch checked={pin} onChange={setPin} label="Sayfanın üstünde uyarı olarak göster" />
          <span className="text-[12.5px] text-sub">Sayfanın üstünde uyarı olarak göster</span>
          <Button type="submit" size="sm" variant="primary" className="ml-auto" busy={add.isPending} disabled={text.trim().length < 2}>
            Not ekle
          </Button>
        </div>
      </form>
      <p className="flex items-center gap-1.5 text-[12px] text-faint">
        <Icon name="lock" size={14} />
        Notlar yalnız panelde görünür; kullanıcıya hiçbir yerde gösterilmez.
      </p>
      {q.isLoading ? (
        <Rows n={2} />
      ) : !rows.length ? (
        <EmptyState
          icon="info"
          title="Not yok"
          body="Bu hesapla ilgili bir şey tespit ettiysen yaz; sonra bakan ekip arkadaşın aynı şeyi baştan araştırmasın."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((n) => (
            <div key={n.id} className="flex items-start gap-3 rounded-[14px] bg-elev2 px-3.5 py-3">
              {n.author && <Avatar src={n.author.avatarPath} name={n.author.displayName ?? n.author.username} size={28} />}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[12px] text-faint">
                  <b className="font-semibold text-sub">@{n.author?.username ?? 'silinmiş hesap'}</b>
                  {timeAgo(n.createdAt)}
                  {n.pinned && <Tag tone="live">Sabit</Tag>}
                </p>
                <p className="mt-0.5 text-[13.5px] break-words whitespace-pre-line">{n.text}</p>
              </div>
              {(isAdmin || n.author?.id === me?.id) && (
                <Button size="xs" variant="ghost" busy={del.isPending && del.variables === n.id} onClick={() => del.mutate(n.id)}>
                  Sil
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
