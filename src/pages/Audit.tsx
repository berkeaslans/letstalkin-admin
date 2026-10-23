import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/icon-names';
import { Card, EmptyState, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { SavedViews } from '@/components/ui/SavedViews';
import { Pills } from '@/components/ui/Tabs';
import { type AuditKind, type AuditRow, adminApi } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { collectAll, downloadCsv } from '@/lib/csv';
import { fmt, timeAgo } from '@/lib/format';
import { toast } from '@/stores/ui';

const KIND: Record<string, [string, IconName, 'yellow' | 'blue' | 'live' | 'up' | undefined]> = {
  tick: ['Tik', 'verified', 'yellow'],
  role: ['Rol', 'admin_panel_settings', 'blue'],
  ban: ['Ban', 'block', 'live'],
  unban: ['Ban kaldırıldı', 'lock', 'up'],
  coin: ['Coin', 'toll', 'yellow'],
  flag: ['Bayrak', 'settings', undefined],
  report: ['Şikayet', 'crisis_alert', 'live'],
  verification: ['Mavi tik', 'verified', 'blue'],
  series_page: ['Dizi sayfası', 'movie', 'yellow'],
  password_reset: ['Şifre sıfırlama', 'lock', 'blue'],
  sessions: ['Oturum', 'logout', undefined],
  email: ['E-posta', 'info', undefined],
  profile: ['Profil', 'person', undefined],
  account_type: ['Hesap türü', 'person', 'yellow'],
  trusted: ['Güvenilirlik', 'workspace_premium', 'blue'],
  deletion: ['Silme', 'remove_circle', 'live'],
  auto_hide: ['Otomatik gizleme', 'visibility_off', 'live'],
  content: ['İçerik kaldırma', 'visibility_off', 'live'],
  restore: ['Geri alma', 'refresh', 'up'],
  room: ['Oda', 'groups', undefined],
  match: ['Eşleşme', 'person', undefined],
  blocklist: ['Kara liste', 'shield', undefined],
  setting: ['Ayar', 'settings', undefined],
  publish: ['Yayın', 'campaign', 'yellow'],
  quiz: ['Quiz', 'bolt', undefined],
  live: ['Canlı yayın', 'tv', 'live'],
  broadcast: ['Duyuru', 'campaign', 'yellow'],
  sticker: ['Sticker', 'toll', 'yellow'],
  market: ['Pazar', 'toll', undefined],
  product: ['Ürün', 'toll', undefined],
  settings_app: ['Sistem ayarı', 'settings', 'blue'],
  maintenance: ['Bakım', 'settings', 'live'],
  feedback: ['Geri bildirim', 'campaign', 'up'],
  catalog: ['Katalog', 'theaters', undefined],
  note: ['Ekip notu', 'info', undefined],
};
const STICKER_OP: Record<string, string> = { create: 'basıldı', edit: 'düzenlendi', delete: 'silindi', grant: 'hediye edildi' };
const PRODUCT_OP: Record<string, string> = { create: 'eklendi', edit: 'düzenlendi', delete: 'silindi' };
const QUEUE_OP: Record<string, string> = {
  queue_retry: 'başarısız işler yeniden denendi',
  queue_clean: 'başarısız işler temizlendi',
  queue_pause: 'kuyruk duraklatıldı',
  queue_resume: 'kuyruk sürdürüldü',
  run_job: 'bakım işi çalıştırıldı',
};
const TICK: Record<string, string> = { none: 'tik yok', yellow: 'sarı', blue: 'mavi' };
const ROLE: Record<string, string> = { user: 'kullanıcı', moderator: 'moderatör', admin: 'admin' };
const PUBLISH_KIND: Record<string, string> = { post: 'gönderi', room: 'oda', room_message: 'oda mesajı', quiz: 'quiz' };
const QUIZ_OP: Record<string, string> = { edit: 'düzenlendi', start: 'başlatıldı', end: 'erken bitirildi', delete: 'silindi' };
const REPORT_ACTION: Record<string, string> = { none: 'yoksayıldı', hide: 'içerik kaldırıldı', ban: 'kullanıcı banlandı' };
const SETTING_LABEL: Record<string, string> = {
  'app.registrationOpen': 'Yeni kayıtlar',
  'app.maintenance': 'Bakım modu',
  'app.minVersion': 'Asgari sürüm',
  'coins.rewards': 'Coin ödülleri',
  'limits.rooms': 'Oda eşikleri',
  'moderation.autoHideThreshold': 'Otomatik gizleme eşiği',
  'publish.accounts': 'Yayın hesapları',
};
/** Ayar değerini tek satıra sığdır (nesne ise alanları, dizi ise sayısı). */
function short(v: unknown): string {
  if (v == null || v === '') return 'boş';
  if (typeof v === 'boolean') return v ? 'açık' : 'kapalı';
  if (Array.isArray(v)) return `${v.length} kayıt`;
  if (typeof v === 'object')
    return (
      Object.entries(v as Record<string, unknown>)
        .filter(([, x]) => x !== '' && x != null)
        .map(([k, x]) => `${k}: ${typeof x === 'boolean' ? (x ? 'açık' : 'kapalı') : x}`)
        .join(', ') || 'boş'
    );
  return String(v);
}

/** detail JSON'unu okunur cümleye çevirir. */
export function describe(a: AuditRow): string {
  const d = (a.detail ?? {}) as Record<string, unknown>;
  switch (a.action) {
    case 'tick':
      return d.manual === null
        ? `elle verilen kaldırıldı → ${TICK[String(d.to)] ?? d.to} (otomatik)`
        : `${TICK[String(d.from)] ?? d.from} → ${TICK[String(d.to)] ?? d.to} (elle)`;
    case 'role':
      return `${ROLE[String(d.from)] ?? d.from} → ${ROLE[String(d.to)] ?? d.to}`;
    case 'ban':
      return 'banlandı';
    case 'unban':
      return 'ban kaldırıldı';
    case 'coin':
      return `${Number(d.amount) > 0 ? '+' : ''}${fmt(Number(d.amount))} coin · yeni bakiye ${fmt(Number(d.balance))}`;
    case 'flag':
      return d.enabled === null ? 'varsayılana döndü' : d.enabled ? 'açıldı' : 'kapatıldı';
    case 'report':
      if (d.op === 'bulk') return `toplu karar: ${d.closed} şikayet kapandı${d.hidden ? `, ${d.hidden} içerik kaldırıldı` : ''}`;
      return `${d.targetType} şikayeti · ${REPORT_ACTION[String(d.action)] ?? d.status}`;
    case 'verification':
      return d.approve ? 'mavi tik onaylandı' : 'başvuru reddedildi';
    case 'password_reset':
      return 'sıfırlama kodu e-postayla gönderildi';
    case 'sessions':
      return d.device
        ? 'bildirim cihazı kaldırıldı'
        : d.family === 'all'
          ? `tüm oturumlar kapatıldı (${d.revoked})`
          : 'bir oturum kapatıldı';
    case 'email':
      return d.action === 'resend' ? 'doğrulama kodu yeniden gönderildi' : 'e-posta doğrulanmış sayıldı';
    case 'profile':
      return d.cleared
        ? `temizlendi: ${(d.cleared as string[]).join(', ')}`
        : `düzenlendi: ${((d.changed as string[]) ?? []).join(', ')}${d.usernameTo ? ` (@${d.usernameFrom} → @${d.usernameTo})` : ''}`;
    case 'account_type':
      return `${d.from} → ${d.to}`;
    case 'trusted':
      return d.manual === null ? 'otomatik kademeye döndü' : d.manual ? 'elle güvenilir yapıldı' : 'güvenilirlik elle alındı';
    case 'deletion':
      return d.action === 'request' ? 'silme talebi başlatıldı' : 'hesap geri yüklendi';
    case 'auto_hide':
      return `${d.reporters} farklı şikayetle otomatik gizlendi (eşik ${d.threshold})`;
    case 'content':
      return `${d.kind} kaldırıldı`;
    case 'restore':
      return `${d.kind} geri alındı`;
    case 'room':
      return d.op === 'remove_member'
        ? 'odadan çıkarıldı'
        : d.op === 'owner'
          ? 'oda sahipliği devredildi'
          : d.op === 'edit'
            ? 'oda ayarları düzenlendi'
            : `oda ${d.to === 'archived' ? 'arşivlendi' : 'yeniden açıldı'}`;
    case 'publish':
      if (d.op === 'account_add') return 'yayın hesaplarına eklendi';
      if (d.op === 'account_remove') return 'yayın hesaplarından çıkarıldı';
      return `adına ${PUBLISH_KIND[String(d.kind)] ?? String(d.kind)} yayınlandı${d.name || d.title ? `: ${d.name ?? d.title}` : ''}`;
    case 'quiz':
      return `quiz ${QUIZ_OP[String(d.op)] ?? String(d.op)}${d.title ? `: ${d.title}` : ''}`;
    case 'match':
      return d.active ? 'eşleşme profili açıldı' : 'eşleşme profili kapatıldı';
    case 'blocklist':
      return `${d.op === 'add' ? 'eklendi' : 'çıkarıldı'}: ${d.pattern}`;
    case 'setting':
      return `${a.targetId}: ${d.from} → ${d.to}`;
    case 'live':
      return `canlı yayın sonlandırıldı${d.title ? `: ${d.title}` : ''}`;
    case 'broadcast':
      return `${d.label ?? ''} kitlesine duyuru${d.title ? ` — "${d.title}"` : ''}${d.sent != null ? ` · ${d.sent}/${d.queued} gönderildi` : ''}`;
    case 'sticker':
      return `sticker ${STICKER_OP[String(d.op)] ?? String(d.op)}${d.name ? `: ${d.name}` : ''}`;
    case 'market':
      return `ilan kaldırıldı${d.sticker ? `: ${d.sticker}` : ''}${d.price ? ` (${d.price} coin)` : ''}`;
    case 'product':
      return `ürün ${PRODUCT_OP[String(d.op)] ?? String(d.op)}${d.name ? `: ${d.name}` : ''}`;
    case 'settings_app':
      return `${SETTING_LABEL[String(d.key)] ?? String(d.key ?? a.targetId)}: ${short(d.from)} → ${short(d.to)}`;
    case 'maintenance':
      // Hem bakım modu anahtarı hem kuyruk/iş işlemleri bu türle yazılır.
      if (d.op) return `${QUEUE_OP[String(d.op)] ?? String(d.op)}${d.label ? `: ${d.label}` : ''}${d.affected ? ` (${d.affected})` : ''}`;
      return `${SETTING_LABEL[String(d.key)] ?? String(d.key ?? a.targetId)}: ${short(d.from)} → ${short(d.to)}`;
    case 'feedback':
      return d.op === 'reply'
        ? 'geri bildirim yanıtlandı'
        : `geri bildirim ${d.to === 'resolved' ? 'çözüldü işaretlendi' : 'okundu işaretlendi'}`;
    case 'catalog':
      return d.op === 'featured'
        ? `vitrin güncellendi: ${(d.to as string[] | undefined)?.join(', ') || 'boşaltıldı'}`
        : 'TMDB bilgisi tazelendi';
    case 'note':
      return d.op === 'delete' ? 'ekip notu silindi' : `ekip notu eklendi${d.pinned ? ' (sabitlendi)' : ''}`;
    case 'series_page':
      return `${d.kind === 'official' ? 'resmi' : 'fan'} sayfa ${d.revoked ? 'kaldırıldı' : d.approve ? 'onaylandı' : 'reddedildi'}`;
    default:
      return '';
  }
}

export function AuditList({ items, compact }: { items: AuditRow[]; compact?: boolean }) {
  if (!items.length) return <EmptyState icon="history" title="Kayıt yok" body="Yönetici işlemleri burada görünür." />;
  return (
    <div>
      {items.map((a) => {
        const k = KIND[a.action] ?? ['İşlem', 'bolt', undefined];
        const target = a.targetUsername
          ? `@${a.targetUsername}`
          : ['flag', 'setting', 'blocklist', 'auto_hide', 'restore'].includes(a.action)
            ? ''
            : 'silinmiş hesap';
        return (
          <div key={a.id} className="flex items-start gap-3 px-[18px] py-3 shadow-[inset_0_0.5px_0_var(--color-line)]">
            <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-elev2 text-sub">
              <Icon name={k[1]} size={16} />
            </span>
            <div className="min-w-0 flex-1 text-[13px] leading-[1.45]">
              <p>
                <b className="font-semibold">{a.actor ? `@${a.actor.username}` : 'Sistem'}</b>
                {!compact && (
                  <>
                    {' '}
                    <Tag tone={k[2]}>{k[0]}</Tag>{' '}
                  </>
                )}
                {compact && <span className="text-sub"> · {k[0].toLowerCase()} · </span>}
                <span className="font-semibold">{target}</span>
              </p>
              <p className="text-[12.5px] text-sub">
                {describe(a)}
                {a.note && <span className="text-faint"> — {a.note}</span>}
              </p>
            </div>
            <span className="flex-none text-[11.5px] whitespace-nowrap text-faint tabular">{timeAgo(a.createdAt)}</span>
          </div>
        );
      })}
    </div>
  );
}

const FILTERS: Array<{ key: AuditKind | 'all'; label: string }> = [
  { key: 'all', label: 'Tümü' },
  { key: 'tick', label: 'Tik' },
  { key: 'role', label: 'Rol' },
  { key: 'ban', label: 'Ban' },
  { key: 'coin', label: 'Coin' },
  { key: 'report', label: 'Şikayet' },
  { key: 'verification', label: 'Mavi tik' },
  { key: 'series_page', label: 'Dizi sayfası' },
  { key: 'flag', label: 'Bayrak' },
  { key: 'publish', label: 'Yayın' },
  { key: 'quiz', label: 'Quiz' },
  { key: 'room', label: 'Oda' },
  { key: 'broadcast', label: 'Duyuru' },
  { key: 'sticker', label: 'Sticker' },
  { key: 'product', label: 'Ürün' },
  { key: 'settings_app', label: 'Ayar' },
  { key: 'maintenance', label: 'Bakım' },
  { key: 'catalog', label: 'Katalog' },
  { key: 'feedback', label: 'Geri bildirim' },
  { key: 'content', label: 'İçerik kaldırma' },
  { key: 'auto_hide', label: 'Otomatik gizleme' },
  { key: 'note', label: 'Ekip notu' },
];

export function Audit() {
  const [kind, setKind] = useState<AuditKind | 'all'>('all');
  const [actor, setActor] = useState('');
  const [text, setText] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const term = useDebounced(text.trim());
  const actors = useQuery({ queryKey: ['admin', 'audit', 'actors'], queryFn: adminApi.auditActors });

  const params = {
    action: kind === 'all' ? undefined : kind,
    actorId: actor || undefined,
    q: term || undefined,
    from: from || undefined,
    to: to || undefined,
  };
  const q = useInfiniteQuery({
    queryKey: ['admin', 'audit', params],
    queryFn: ({ pageParam }) => adminApi.audit({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const filtered = kind !== 'all' || actor || term || from || to;

  async function exportCsv() {
    setExporting(true);
    try {
      const all = await collectAll<AuditRow>((cursor) => adminApi.audit({ ...params, cursor, limit: 500 }));
      downloadCsv('denetim-kaydi', all, [
        { header: 'Zaman', value: (a) => new Date(a.createdAt) },
        { header: 'Yönetici', value: (a) => (a.actor ? `@${a.actor.username}` : 'Sistem') },
        { header: 'İşlem', value: (a) => (KIND[a.action] ?? ['İşlem'])[0] },
        { header: 'Hedef', value: (a) => (a.targetUsername ? `@${a.targetUsername}` : a.targetId) },
        { header: 'Ayrıntı', value: (a) => describe(a) },
        { header: 'Gerekçe', value: (a) => a.note },
      ]);
      toast(`${all.length} kayıt indirildi`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setExporting(false);
    }
  }

  const dateInput = 'h-[34px] rounded-full bg-elev2 px-3 text-[12.5px] text-sub outline-none shadow-[inset_0_0_0_0.5px_var(--color-line2)]';
  return (
    <Card>
      <div className="px-[18px] pt-3.5">
        <Pills items={FILTERS} value={kind} onChange={setKind} />
      </div>
      <div className="flex flex-wrap items-center gap-2 px-[18px] py-3">
        <label className="flex h-[34px] min-w-[200px] flex-1 items-center gap-2 rounded-full bg-elev2 px-3 shadow-[inset_0_0_0_0.5px_var(--color-line2)]">
          <Icon name="search" size={17} className="text-faint" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Gerekçede ve ayrıntıda ara"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
          />
        </label>
        <select
          aria-label="Yönetici"
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          className="h-[34px] rounded-full bg-elev2 px-3 text-[12.5px] font-semibold text-sub outline-none shadow-[inset_0_0_0_0.5px_var(--color-line2)]"
        >
          <option value="">Herkes</option>
          {(actors.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.username ? `@${a.username}` : a.id === 'system' ? 'Sistem' : 'silinmiş hesap'} ({a.count})
            </option>
          ))}
        </select>
        <input
          aria-label="Başlangıç"
          type="date"
          className={dateInput}
          value={from}
          max={to || undefined}
          onChange={(e) => setFrom(e.target.value)}
        />
        <span className="text-[12px] text-faint">–</span>
        <input
          aria-label="Bitiş"
          type="date"
          className={dateInput}
          value={to}
          min={from || undefined}
          onChange={(e) => setTo(e.target.value)}
        />
        {filtered && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              setKind('all');
              setActor('');
              setText('');
              setFrom('');
              setTo('');
            }}
          >
            Temizle
          </Button>
        )}
        <Button size="xs" variant="outline" busy={exporting} onClick={exportCsv} title="Bu filtredeki kayıtları CSV indir">
          CSV
        </Button>
      </div>
      <div className="px-[18px] pb-3">
        <SavedViews
          page="audit"
          query={{ action: kind, actorId: actor, q: term, from, to }}
          onApply={(v) => {
            setKind((v.action as AuditKind) ?? 'all');
            setActor(String(v.actorId ?? ''));
            setText(String(v.q ?? ''));
            setFrom(String(v.from ?? ''));
            setTo(String(v.to ?? ''));
          }}
        />
      </div>
      {q.isLoading ? (
        <Rows />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !items.length ? (
        <EmptyState
          icon="history"
          title={filtered ? 'Bu filtrede kayıt yok' : 'Henüz işlem yok'}
          body={
            filtered
              ? 'Tarih aralığını genişlet ya da filtreyi temizle.'
              : 'Panelden yapılan her işlem — tik, rol, ban, coin, içerik kaldırma, ayar değişikliği — kim, ne zaman, neden bilgisiyle buraya yazılır. Kayıtlar silinemez.'
          }
        />
      ) : (
        <AuditList items={items} />
      )}
      {q.hasNextPage && (
        <div className="flex justify-center p-4">
          <Button size="sm" variant="outline" busy={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
            Daha eski kayıtlar
          </Button>
        </div>
      )}
    </Card>
  );
}

function useDebounced<T>(v: T, ms = 350) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}
