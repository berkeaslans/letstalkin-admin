// Ekip: panele girebilen hesaplar. Üç iş burada biter — mevcut bir hesaba yetki
// vermek, sıfırdan panel hesabı açıp giriş bilgilerini almak, yetkiyi geri almak.
// Sunucuya hiç dokunmadan; her değişiklik denetim kaydına düşer.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, EmptyState, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { adminApi, type StaffCredentials, type StaffRow, type UserRow } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/format';
import { paths } from '@/lib/go';
import { useIsAdmin } from '@/stores/session';
import { confirmAction, toast } from '@/stores/ui';

const ROL: Record<'moderator' | 'admin', string> = { moderator: 'Moderatör', admin: 'Admin' };
const input =
  'h-10 w-full rounded-option bg-elev2 px-3 text-[14px] outline-none shadow-[inset_0_0_0_0.5px_var(--color-line2)] placeholder:text-faint focus:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.32)]';
const label = 'mb-1.5 block text-[12.5px] font-semibold text-sub';

/** Üretilen giriş bilgileri: bir daha gösterilmez, kopyalanabilir. */
function Credentials({ cred, onClose }: { cred: StaffCredentials; onClose: () => void }) {
  const [kopyalandi, setKopyalandi] = useState(false);
  // Panelin kendi adresi: yerelde localhost, canlıda gerçek alan adı.
  const metin = `Panel: ${window.location.origin}\nKullanıcı adı: ${cred.username}\nŞifre: ${cred.password}`;
  return (
    <div className="mx-[18px] mb-4 rounded-option bg-yellow/10 p-4 shadow-[inset_0_0_0_0.5px_rgb(255_216_0/0.35)]">
      <p className="flex items-center gap-1.5 text-[13.5px] font-bold text-yellow">
        <Icon name="lock" size={16} />@{cred.username} için giriş bilgileri
      </p>
      <p className="mt-1 text-[12.5px] text-sub">
        Bu şifre bir daha gösterilmez. Şimdi ilet; ilk girişten sonra uygulamadan değiştirmesini söyle.
      </p>
      <pre className="mt-3 overflow-x-auto rounded-option bg-black/30 p-3 text-[13px] leading-relaxed">{metin}</pre>
      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          {...(kopyalandi ? { icon: 'check_circle' as const } : {})}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(metin);
              setKopyalandi(true);
            } catch {
              toast('Kopyalanamadı, elle seç', 'error');
            }
          }}
        >
          {kopyalandi ? 'Kopyalandı' : 'Kopyala'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Kapat
        </Button>
      </div>
    </div>
  );
}

/** Mevcut hesaba yetki ver: kullanıcı ara, rolünü seç. */
function GrantExisting({ onDone }: { onDone: (rows: StaffRow[]) => void }) {
  const [q, setQ] = useState('');
  const [secili, setSecili] = useState<UserRow | null>(null);
  const [rol, setRol] = useState<'moderator' | 'admin'>('moderator');
  const terim = q.trim();
  const arama = useQuery({
    queryKey: ['admin', 'users', 'ekip-ara', terim],
    queryFn: () => adminApi.users({ q: terim, limit: 6 }),
    enabled: terim.length >= 2 && !secili,
  });
  const ver = useMutation({
    mutationFn: () => adminApi.setStaffRole(secili!.id, rol),
    onSuccess: (rows) => {
      toast(`@${secili!.username} artık ${ROL[rol].toLowerCase()}`, 'success', 'Panele kendi şifresiyle girer');
      setSecili(null);
      setQ('');
      onDone(rows);
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  const bulunan = (arama.data?.items ?? []).filter((u) => u.role === 'user');

  return (
    <div className="px-[18px] pb-4">
      {secili ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2">
            <Avatar src={secili.avatarPath} name={secili.username} size={30} />
            <span className="text-[14px] font-semibold">@{secili.username}</span>
          </span>
          <select className={cn(input, 'h-9 w-[150px]')} value={rol} onChange={(e) => setRol(e.target.value as 'moderator' | 'admin')}>
            <option value="moderator">Moderatör</option>
            <option value="admin">Admin</option>
          </select>
          <Button size="sm" variant="primary" busy={ver.isPending} onClick={() => ver.mutate()}>
            Yetki ver
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSecili(null)}>
            Vazgeç
          </Button>
        </div>
      ) : (
        <>
          <input
            className={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Kullanıcı adı ya da ad ara…"
            aria-label="Yetki verilecek kişiyi ara"
          />
          {terim.length >= 2 && (
            <div className="mt-2 flex flex-col">
              {arama.isPending ? (
                <p className="py-2 text-[13px] text-faint">Aranıyor…</p>
              ) : bulunan.length ? (
                bulunan.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="flex items-center gap-2.5 rounded-option px-2 py-2 text-left hover:bg-elev2"
                    onClick={() => setSecili(u)}
                  >
                    <Avatar src={u.avatarPath} name={u.username} size={28} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-semibold">@{u.username}</span>
                      {u.displayName && <span className="block truncate text-[12px] text-sub">{u.displayName}</span>}
                    </span>
                  </button>
                ))
              ) : (
                <p className="py-2 text-[13px] text-faint">Eşleşen hesap yok. Yetkisi olanlar bu listede çıkmaz; aşağıdaki tablodan bak.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Yeni panel hesabı: uygulamada hesabı olmayan birine. */
function CreateAccount({ onCreated }: { onCreated: (c: StaffCredentials) => void }) {
  const [acik, setAcik] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [isim, setIsim] = useState('');
  const [rol, setRol] = useState<'moderator' | 'admin'>('moderator');
  const qc = useQueryClient();
  const ac = useMutation({
    mutationFn: () =>
      adminApi.createStaff({
        username: username.trim().toLowerCase(),
        email: email.trim(),
        role: rol,
        displayName: isim.trim() || undefined,
      }),
    onSuccess: (c) => {
      setAcik(false);
      setUsername('');
      setEmail('');
      setIsim('');
      void qc.invalidateQueries({ queryKey: ['admin', 'staff'] });
      onCreated(c);
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  if (!acik) {
    return (
      <div className="px-[18px] pb-4">
        <Button icon="add_circle" onClick={() => setAcik(true)}>
          Yeni panel hesabı aç
        </Button>
        <p className="mt-2 text-[12.5px] text-sub">Uygulamada hesabı olmayan birine. Şifresini panel üretir, sana gösterir.</p>
      </div>
    );
  }
  const gecerliAd = /^[a-z0-9_.]{3,24}$/.test(username.trim().toLowerCase());
  return (
    <form
      className="flex flex-col gap-3 px-[18px] pb-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (gecerliAd && email.trim()) ac.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="ekip-ad">
            Kullanıcı adı
          </label>
          <input
            id="ekip-ad"
            className={input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ortak"
            maxLength={24}
            autoFocus
          />
          {username && !gecerliAd && <p className="mt-1 text-[12px] text-live">3-24 karakter; yalnız küçük harf, rakam, _ ve .</p>}
        </div>
        <div>
          <label className={label} htmlFor="ekip-eposta">
            E-posta
          </label>
          <input
            id="ekip-eposta"
            className={input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ortak@letstalkin.com"
          />
        </div>
        <div>
          <label className={label} htmlFor="ekip-isim">
            Görünen ad <span className="font-normal text-faint">— isteğe bağlı</span>
          </label>
          <input id="ekip-isim" className={input} value={isim} onChange={(e) => setIsim(e.target.value)} maxLength={50} />
        </div>
        <div>
          <label className={label} htmlFor="ekip-rol">
            Rol
          </label>
          <select id="ekip-rol" className={input} value={rol} onChange={(e) => setRol(e.target.value as 'moderator' | 'admin')}>
            <option value="moderator">Moderatör — şikayet, içerik, kullanıcı</option>
            <option value="admin">Admin — her şey</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" busy={ac.isPending} disabled={!gecerliAd || !email.trim()}>
          Hesabı aç
        </Button>
        <Button type="button" variant="ghost" onClick={() => setAcik(false)}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}

export function Team() {
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const [cred, setCred] = useState<StaffCredentials | null>(null);
  const q = useQuery({ queryKey: ['admin', 'staff'], queryFn: () => adminApi.staff() });
  const yaz = (rows: StaffRow[]) => qc.setQueryData(['admin', 'staff'], rows);

  const rolDegistir = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'user' | 'moderator' | 'admin' }) => adminApi.setStaffRole(id, role),
    onSuccess: (rows) => {
      toast('Rol güncellendi');
      yaz(rows);
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const sifreUret = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => adminApi.tempPassword(id, note),
    onSuccess: (c) => {
      setCred(c);
      if (c.sessionsRevoked) toast(`${c.sessionsRevoked} oturum kapatıldı`, 'info', 'Yeni şifreyle tekrar girmesi gerekiyor');
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  const rows = q.data ?? [];
  const adminler = rows.filter((r) => r.role === 'admin').length;

  return (
    <div className="flex flex-col gap-4">
      {isAdmin && (
        <Card title="Mevcut hesaba yetki ver" sub="Uygulamada hesabı olan biri — kendi şifresiyle girer">
          <GrantExisting onDone={yaz} />
        </Card>
      )}
      {isAdmin && (
        <Card title="Yeni panel hesabı">
          <CreateAccount onCreated={setCred} />
        </Card>
      )}
      {cred && (
        <Card title="Giriş bilgileri">
          <Credentials cred={cred} onClose={() => setCred(null)} />
        </Card>
      )}

      <Card
        title="Panele girebilenler"
        sub={rows.length ? `${rows.length} kişi · ${adminler} admin` : undefined}
        right={
          <Button size="sm" variant="ghost" icon="refresh" onClick={() => q.refetch()} busy={q.isFetching}>
            Yenile
          </Button>
        }
      >
        {q.isError ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : q.isPending ? (
          <Rows n={3} />
        ) : !rows.length ? (
          <EmptyState
            icon="group"
            title="Panele girebilen kimse yok"
            body="Moderatör şikayetlere karar verir, içerik kaldırır ve kullanıcı işlemleri yapar. Admin ayrıca tik, rol, coin, ekonomi, yayın ve sistem ayarlarını yönetir."
          />
        ) : (
          <div className="flex flex-col">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-line/60 border-t px-[18px] py-3 first:border-t-0"
              >
                <Avatar name={r.username} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-[14px] font-semibold">
                    <a className="hover:underline" href={paths.user(r.id)}>
                      @{r.username}
                    </a>
                    {r.isSelf && <Tag>sen</Tag>}
                    {r.panelAccount && (
                      <span title="Hesabı panel açtı">
                        <Icon name="lock" size={13} className="text-faint" />
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[12px] text-sub">
                    {r.displayName ? `${r.displayName} · ` : ''}
                    {r.email}
                    {r.lastActiveAt ? ` · son görülme ${timeAgo(r.lastActiveAt)}` : ' · hiç girmemiş'}
                  </p>
                </div>
                <Tag tone={r.role === 'admin' ? 'yellow' : undefined}>{ROL[r.role]}</Tag>
                {isAdmin && !r.isSelf && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="xs"
                      variant="ghost"
                      busy={rolDegistir.isPending}
                      onClick={() => rolDegistir.mutate({ id: r.id, role: r.role === 'admin' ? 'moderator' : 'admin' })}
                    >
                      {r.role === 'admin' ? 'Moderatör yap' : 'Admin yap'}
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      icon="lock"
                      busy={sifreUret.isPending}
                      title="Geçici şifre üret"
                      onClick={async () => {
                        const c = await confirmAction({
                          title: `@${r.username} için geçici şifre üretilsin mi?`,
                          body: 'Eski şifre geçersiz olur, açık oturumları kapanır, yeni şifre bir kez gösterilir. Gerekçe denetim kaydına yazılır.',
                          ok: 'Üret',
                          note: 'required',
                        });
                        if (c.ok) sifreUret.mutate({ id: r.id, note: c.note });
                      }}
                    >
                      Şifre
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={async () => {
                        const c = await confirmAction({
                          title: `@${r.username} panelden çıkarılsın mı?`,
                          body: 'Hesap silinmez, yalnız yönetim yetkisi kalkar. Uygulamayı normal kullanmaya devam eder.',
                          ok: 'Yetkiyi al',
                          danger: true,
                        });
                        if (c.ok) rolDegistir.mutate({ id: r.id, role: 'user' });
                      }}
                    >
                      Çıkar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
