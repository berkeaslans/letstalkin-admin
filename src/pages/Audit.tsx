import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/icon-names';
import { Card, EmptyState, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { Pills } from '@/components/ui/Tabs';
import { type AuditKind, type AuditRow, adminApi } from '@/lib/api/admin';
import { fmt, timeAgo } from '@/lib/format';

const KIND: Record<string, [string, IconName, 'yellow' | 'blue' | 'live' | 'up' | undefined]> = {
  tick: ['Tik', 'verified', 'yellow'],
  role: ['Rol', 'admin_panel_settings', 'blue'],
  ban: ['Ban', 'block', 'live'],
  unban: ['Ban kaldırıldı', 'lock', 'up'],
  coin: ['Coin', 'toll', 'yellow'],
  flag: ['Bayrak', 'toggle_on', undefined],
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
};
const TICK: Record<string, string> = { none: 'tik yok', yellow: 'sarı', blue: 'mavi' };
const ROLE: Record<string, string> = { user: 'kullanıcı', moderator: 'moderatör', admin: 'admin' };
const REPORT_ACTION: Record<string, string> = { none: 'yoksayıldı', hide: 'içerik kaldırıldı', ban: 'kullanıcı banlandı' };

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
          : `oda ${d.to === 'archived' ? 'arşivlendi' : 'yeniden açıldı'}`;
    case 'match':
      return d.active ? 'eşleşme profili açıldı' : 'eşleşme profili kapatıldı';
    case 'blocklist':
      return `${d.op === 'add' ? 'eklendi' : 'çıkarıldı'}: ${d.pattern}`;
    case 'setting':
      return `${a.targetId}: ${d.from} → ${d.to}`;
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
];

export function Audit() {
  const [kind, setKind] = useState<AuditKind | 'all'>('all');
  const q = useInfiniteQuery({
    queryKey: ['admin', 'audit', kind],
    queryFn: ({ pageParam }) => adminApi.audit({ action: kind === 'all' ? undefined : kind, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <Card>
      <div className="px-[18px] py-3.5">
        <Pills items={FILTERS} value={kind} onChange={setKind} />
      </div>
      {q.isLoading ? <Rows /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : <AuditList items={items} />}
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
