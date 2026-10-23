// Kullanıcı listesi: filtre, arama, sıralama (tüm listeye uygulanır), CSV
// dışa aktarma. Satıra tıklayınca kullanıcının kendi sayfası açılır.
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Avatar, Tick } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, EmptyState, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { Pills } from '@/components/ui/Tabs';
import { adminApi, type UserFilter, type UserRow, type UserSort } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { collectAll, downloadCsv } from '@/lib/csv';
import { compact, fmt, timeAgo } from '@/lib/format';
import { toast } from '@/stores/ui';
import { ACCOUNT, openUser } from './UserPage';

function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

const SORTS: Array<{ key: UserSort; label: string }> = [
  { key: 'new', label: 'Önce yeni katılan' },
  { key: 'old', label: 'Önce eski katılan' },
  { key: 'followers', label: 'Çok takipçili' },
  { key: 'active', label: 'Son aktif olan' },
  { key: 'balance', label: 'Çok coinli' },
];
const ROLE_TR = { user: 'Kullanıcı', moderator: 'Moderatör', admin: 'Admin' } as const;
const date = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';

export function UserTable({ filter, emptyTitle, emptyBody }: { filter: UserFilter; emptyTitle?: string; emptyBody?: string }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<UserSort>('new');
  const [exporting, setExporting] = useState(false);
  const term = useDebounced(q.trim());
  const res = useInfiniteQuery({
    queryKey: ['admin', 'users', filter, term, sort],
    queryFn: ({ pageParam }) => adminApi.users({ q: term || undefined, filter, sort, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const rows = res.data?.pages.flatMap((p) => p.items) ?? [];

  async function exportCsv() {
    setExporting(true);
    try {
      const all = await collectAll<UserRow>((cursor) => adminApi.users({ q: term || undefined, filter, sort, cursor, limit: 200 }));
      downloadCsv('kullanicilar', all, [
        { header: 'Kullanıcı adı', value: (u) => u.username },
        { header: 'Görünen ad', value: (u) => u.displayName },
        { header: 'Hesap türü', value: (u) => ACCOUNT[u.accountType] },
        { header: 'Rol', value: (u) => ROLE_TR[u.role] },
        { header: 'Tik', value: (u) => (u.tick === 'none' ? '' : u.tick === 'yellow' ? 'Sarı' : 'Mavi') },
        { header: 'Takipçi', value: (u) => u.followerCount },
        { header: 'Coin', value: (u) => u.balance },
        { header: 'Şikayet', value: (u) => u.reportCount },
        { header: 'Durum', value: (u) => (u.isBanned ? 'Banlı' : 'Aktif') },
        { header: 'Güvenilir', value: (u) => (u.isTrusted ? 'Evet' : 'Hayır') },
        { header: 'Katılım', value: (u) => new Date(u.createdAt) },
        { header: 'Son aktiflik', value: (u) => (u.lastActiveAt ? new Date(u.lastActiveAt) : '') },
        { header: 'Kimlik', value: (u) => u.id },
      ]);
      toast(`${fmt(all.length)} kullanıcı indirildi`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-[18px] pb-3">
        <label className="flex h-10 w-full max-w-[380px] min-w-[220px] flex-1 items-center gap-2 rounded-full bg-elev2 px-3.5 shadow-[inset_0_0_0_0.5px_var(--color-line2)]">
          <Icon name="search" size={19} className="text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ad, @kullanıcı adı, e-posta veya kimlik"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-faint"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Temizle" className="text-faint hover:text-text">
              <Icon name="close" size={16} />
            </button>
          )}
        </label>
        <select
          aria-label="Sıralama"
          value={sort}
          onChange={(e) => setSort(e.target.value as UserSort)}
          className="h-10 rounded-full bg-elev2 px-3.5 text-[13px] font-semibold text-sub outline-none shadow-[inset_0_0_0_0.5px_var(--color-line2)]"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" busy={exporting} onClick={exportCsv} title="Filtreye uyan tüm kullanıcıları CSV olarak indir">
          CSV
        </Button>
      </div>
      {res.isLoading ? (
        <Rows />
      ) : res.isError ? (
        <ErrorState error={res.error} retry={() => res.refetch()} />
      ) : !rows.length ? (
        <EmptyState
          icon="person_search"
          title={term ? 'Eşleşen kullanıcı yok' : (emptyTitle ?? 'Kayıt yok')}
          body={term ? 'Kullanıcı adı, görünen ad ya da kimlikle aramayı dene; e-postayla arama yalnız adminlerde çalışır.' : emptyBody}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="text-left text-[12px] font-semibold text-faint">
                <th className="px-[18px] py-2.5 font-semibold">Kullanıcı</th>
                <th className="px-3 py-2.5 font-semibold">Rol</th>
                <th className="px-3 py-2.5 text-right font-semibold">Takipçi</th>
                <th className="hidden px-3 py-2.5 text-right font-semibold lg:table-cell">Coin</th>
                <th className="hidden px-3 py-2.5 font-semibold md:table-cell">Katılım</th>
                <th className="px-3 py-2.5 font-semibold">Son aktiflik</th>
                <th className="px-[18px] py-2.5 font-semibold">Durum</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <Row key={u.id} u={u} />
              ))}
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
      {!!rows.length && (
        <p className="px-[18px] pb-4 text-[11.5px] text-faint">
          {fmt(rows.length)} kayıt gösteriliyor{res.hasNextPage ? ' · devamı var' : ''}
        </p>
      )}
    </>
  );
}

function Row({ u }: { u: UserRow }) {
  return (
    <tr
      className="cursor-pointer shadow-[inset_0_0.5px_0_var(--color-line)] transition-colors hover:bg-white/3"
      onClick={() => openUser(u.id)}
    >
      <td className="px-[18px] py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar src={u.avatarPath} name={u.displayName ?? u.username} size={34} />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-semibold whitespace-nowrap">
              {u.displayName ?? u.username}
              <Tick tick={u.tick} size={13} />
              {u.isTrusted && (
                <span title="Güvenilir hesap" className="flex text-blue">
                  <Icon name="workspace_premium" size={13} />
                </span>
              )}
            </p>
            <p className="text-[12px] whitespace-nowrap text-sub">
              @{u.username} · {ACCOUNT[u.accountType]}
              {u.reportCount > 0 && <span className="text-live"> · {u.reportCount} şikayet</span>}
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">
        {u.role === 'user' ? (
          <span className="text-faint">—</span>
        ) : (
          <Tag tone={u.role === 'admin' ? 'yellow' : 'blue'}>{ROLE_TR[u.role]}</Tag>
        )}
      </td>
      <td className="px-3 py-2.5 text-right tabular">{compact(u.followerCount)}</td>
      <td className="hidden px-3 py-2.5 text-right tabular lg:table-cell">{compact(u.balance)}</td>
      <td className="hidden px-3 py-2.5 whitespace-nowrap text-sub md:table-cell">{date(u.createdAt)}</td>
      <td className="px-3 py-2.5 whitespace-nowrap text-sub">{timeAgo(u.lastActiveAt)}</td>
      <td className="px-[18px] py-2.5">
        {u.isBanned ? <Tag tone="live">Banlı</Tag> : <span className="text-[12.5px] text-sub">Aktif</span>}
      </td>
    </tr>
  );
}

const FILTER_EMPTY: Partial<Record<UserFilter, string>> = {
  tick: 'Sarı ya da mavi tikli hesap yok. Tik vermek için kişiyi bul, sayfasındaki Yönetim sekmesinden ver.',
  pages: 'Fan ya da resmi dizi sayfası yok. Başvurular Kullanıcılar → Dizi sayfaları ekranından onaylanır.',
  reported: 'Hakkında şikayet açılmış hesap yok.',
  banned: 'Banlı hesap yok.',
  deleting: 'Silme talebi veren hesap yok. Talep verenler 30 gün bekler, bu sürede geri dönebilirler.',
};

export function Users() {
  const [filter, setFilter] = useState<UserFilter>('all');
  return (
    <Card>
      <div className="px-[18px] py-3.5">
        <Pills
          items={[
            { key: 'all', label: 'Hepsi' },
            { key: 'tick', label: 'Tikli' },
            { key: 'pages', label: 'Sayfalar' },
            { key: 'reported', label: 'Şikayetli' },
            { key: 'banned', label: 'Banlı' },
            { key: 'deleting', label: 'Silinecek' },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>
      <UserTable filter={filter} emptyBody={FILTER_EMPTY[filter]} />
    </Card>
  );
}

export function Team() {
  return (
    <Card title="Ekip" sub="Rol değiştirmek için kişiye tıkla. Yeni birini eklemek için Kullanıcılar'dan bul ve rolünü değiştir.">
      <UserTable
        filter="staff"
        emptyTitle="Ekipte kimse yok"
        emptyBody="Moderatör şikayetlere karar verir ve içerik kaldırır; admin ayrıca tik, rol, coin, ekonomi ve sistem ayarlarını yönetir."
      />
    </Card>
  );
}
