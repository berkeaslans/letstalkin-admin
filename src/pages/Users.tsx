import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Avatar, Tick } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, EmptyState, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { Pills } from '@/components/ui/Tabs';
import { adminApi, type UserFilter, type UserRow } from '@/lib/api/admin';
import { compact, timeAgo } from '@/lib/format';
import { ACCOUNT, openUser } from './UserPage';

function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export function UserTable({ filter, emptyTitle }: { filter: UserFilter; emptyTitle?: string }) {
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim());
  const res = useInfiniteQuery({
    queryKey: ['admin', 'users', filter, term],
    queryFn: ({ pageParam }) => adminApi.users({ q: term || undefined, filter, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const rows = res.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <div className="px-[18px] pb-3">
        <label className="flex h-10 w-full max-w-[380px] items-center gap-2 rounded-full bg-elev2 px-3.5 shadow-[inset_0_0_0_0.5px_var(--color-line2)]">
          <Icon name="search" size={19} className="text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ad, @kullanıcı adı, e-posta veya kimlik"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-faint"
          />
        </label>
      </div>
      {res.isLoading ? (
        <Rows />
      ) : res.isError ? (
        <ErrorState error={res.error} retry={() => res.refetch()} />
      ) : !rows.length ? (
        <EmptyState
          icon="person_search"
          title={term ? 'Eşleşen kullanıcı yok' : (emptyTitle ?? 'Kayıt yok')}
          body={term ? 'Aramayı veya filtreyi değiştir.' : undefined}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="text-left text-[12px] font-semibold text-faint">
                <th className="px-[18px] py-2.5 font-semibold">Kullanıcı</th>
                <th className="px-3 py-2.5 font-semibold">Rol</th>
                <th className="px-3 py-2.5 text-right font-semibold">Takipçi</th>
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
          <Tag tone={u.role === 'admin' ? 'yellow' : 'blue'}>{u.role === 'admin' ? 'Admin' : 'Moderatör'}</Tag>
        )}
      </td>
      <td className="px-3 py-2.5 text-right tabular">{compact(u.followerCount)}</td>
      <td className="px-3 py-2.5 whitespace-nowrap text-sub">{timeAgo(u.lastActiveAt)}</td>
      <td className="px-[18px] py-2.5">
        {u.isBanned ? <Tag tone="live">Banlı</Tag> : <span className="text-[12.5px] text-sub">Aktif</span>}
      </td>
    </tr>
  );
}

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
      <UserTable filter={filter} />
    </Card>
  );
}

export function Team() {
  return (
    <Card title="Ekip" sub="Rol değiştirmek için kişiye tıkla. Yeni birini eklemek için Kullanıcılar'dan bul ve rolünü değiştir.">
      <UserTable filter="staff" emptyTitle="Ekipte kimse yok" />
    </Card>
  );
}
