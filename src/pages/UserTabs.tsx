// Kullanıcı çekmecesi sekmeleri: Profil, Hesap, İçerik, Bağlantılar ve silme talebi.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { Avatar, Tick } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { Pills, Segment } from '@/components/ui/Tabs';
import { type AccountType, adminApi, type ContentKind, type ProfilePatch, type RelationKind, type UserDetail } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { fmt, timeAgo } from '@/lib/format';
import { playSound } from '@/lib/sound';
import { useIsAdmin } from '@/stores/session';
import { confirmAction, toast } from '@/stores/ui';

const field =
  'h-11 w-full rounded-option bg-elev2 px-3.5 text-[14px] outline-none shadow-[inset_0_0_0_0.5px_var(--color-line2)] placeholder:text-faint focus:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.32)]';

function Section({ title, children, hint }: { title: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12.5px] font-semibold text-sub">{title}</p>
      {children}
      {hint && <p className="text-[12px] text-faint">{hint}</p>}
    </div>
  );
}
function Line({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-3 px-3.5 py-2.5 text-[13.5px] shadow-[inset_0_-0.5px_0_var(--color-line)]">{children}</div>;
}

/** Ortak mutasyon: başarı → bildirim + ses + ilgili sorguları tazele. */
function useAct<A extends unknown[]>(u: UserDetail, fn: (...a: A) => Promise<unknown>, done: string | ((r: unknown) => string)) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: A) => fn(...args),
    onSuccess: (r) => {
      toast(typeof done === 'string' ? done : done(r));
      playSound('ok');
      for (const k of [
        ['admin', 'user', u.id],
        ['admin', 'account', u.id],
        ['admin', 'users'],
        ['admin', 'audit'],
        ['admin', 'ucontent', u.id],
      ])
        qc.invalidateQueries({ queryKey: k });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
}

// ---------------- Silme talebi ----------------
export function DeletionBanner({ u }: { u: UserDetail }) {
  const isAdmin = useIsAdmin();
  const restore = useAct(u, (note: string) => adminApi.deletion(u.id, 'restore', note), 'Hesap geri yüklendi');
  return (
    <div className="flex flex-col gap-4 px-[18px] py-4">
      <div className="flex items-center gap-3.5">
        <Avatar src={u.avatarPath} name={u.displayName ?? u.username} size={52} />
        <div>
          <p className="text-[17px] font-bold">{u.displayName ?? u.username}</p>
          <p className="text-[13px] text-sub">@{u.username}</p>
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-[14px] bg-live/10 p-3.5">
        <Icon name="error" size={20} filled className="text-live" />
        <div className="text-[13.5px]">
          <p className="font-semibold">Silme talebinde</p>
          <p className="text-sub">
            {timeAgo(u.deletion!.requestedAt)} istendi.{' '}
            {u.deletion!.purgeAt &&
              `${new Date(u.deletion!.purgeAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} tarihinde kalıcı silinecek.`}{' '}
            Hesap gizli; geri yüklenene kadar başka işlem yapılamaz.
          </p>
        </div>
      </div>
      {isAdmin && (
        <Button
          variant="primary"
          className="self-start"
          busy={restore.isPending}
          onClick={async () => {
            const c = await confirmAction({
              title: 'Hesap geri yüklensin mi?',
              body: 'Hesap yeniden görünür olur; kullanıcı giriş yapabilir.',
              ok: 'Geri yükle',
              note: 'required',
            });
            if (c.ok) restore.mutate([c.note]);
          }}
        >
          Geri yükle
        </Button>
      )}
    </div>
  );
}

// ---------------- Profil ----------------
const ACCOUNT_TYPES: Array<{ key: AccountType; label: string }> = [
  { key: 'person', label: 'Bireysel' },
  { key: 'fan', label: 'Fan' },
  { key: 'official', label: 'Resmi' },
  { key: 'sponsor', label: 'Sponsor' },
];

export function ProfileTab({ u }: { u: UserDetail }) {
  const isAdmin = useIsAdmin();
  const acc = useQuery({ queryKey: ['admin', 'account', u.id], queryFn: () => adminApi.account(u.id) });
  const clear = useAct(
    u,
    (fields: Array<'avatar' | 'cover' | 'bio' | 'displayName' | 'links'>, note: string) => adminApi.clearProfile(u.id, fields, note),
    'Temizlendi',
  );
  const patch = useAct(u, (body: ProfilePatch) => adminApi.patchProfile(u.id, body), 'Profil güncellendi');
  const type = useAct(u, (t: AccountType, note: string) => adminApi.setAccountType(u.id, t, note), 'Hesap türü değişti');
  const trusted = useAct(
    u,
    (v: boolean | null) => adminApi.setTrusted(u.id, v),
    (r) => ((r as { isTrusted: boolean }).isTrusted ? 'Güvenilir hesap' : 'Güvenilir değil'),
  );
  const [form, setForm] = useState<ProfilePatch>({ displayName: u.displayName ?? '', username: u.username });
  const trustMode = acc.data?.trustManual === true ? 'yes' : acc.data?.trustManual === false ? 'no' : 'auto';

  const clearBtn = (f: 'avatar' | 'cover' | 'bio' | 'displayName' | 'links', label: string) => (
    <Button
      size="sm"
      variant="outline"
      disabled={clear.isPending}
      onClick={async () => {
        const c = await confirmAction({
          title: `${label} kaldırılsın mı?`,
          body: 'Uygunsuz içerik için. Kullanıcı yenisini ekleyebilir.',
          ok: 'Kaldır',
          danger: true,
          note: 'optional',
        });
        if (c.ok) clear.mutate([[f], c.note]);
      }}
    >
      {label}
    </Button>
  );

  return (
    <div className="flex flex-col gap-6 px-[18px] pt-1 pb-6">
      <Section title="Uygunsuz alanı kaldır" hint="Moderatör de yapabilir. Her biri denetim kaydına yazılır.">
        <div className="flex flex-wrap gap-2">
          {clearBtn('avatar', 'Profil fotoğrafı')}
          {clearBtn('cover', 'Kapak')}
          {clearBtn('bio', 'Biyografi')}
          {clearBtn('displayName', 'Görünen ad')}
          {clearBtn('links', 'Bağlantılar')}
        </div>
      </Section>

      {isAdmin && (
        <>
          <Section title="Profili düzenle" hint="Kullanıcının kendi kurallarıyla aynı: kullanıcı adı küçük harf, rakam, _ ve . (3–24).">
            <input
              className={field}
              placeholder="Görünen ad"
              value={form.displayName ?? ''}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              maxLength={50}
            />
            <input
              className={field}
              placeholder="kullanici_adi"
              value={form.username ?? ''}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
              maxLength={24}
            />
            <div className="flex items-center gap-2">
              <label className="text-[13px] text-sub" htmlFor="bd">
                Doğum tarihi
              </label>
              <input
                id="bd"
                type="date"
                className={`${field} w-auto`}
                defaultValue={acc.data?.birthDate ?? ''}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value || undefined })}
              />
            </div>
            <label className="flex items-center gap-2 text-[13.5px]">
              <input
                type="checkbox"
                defaultChecked={acc.data?.isPrivate}
                onChange={(e) => setForm({ ...form, isPrivate: e.target.checked })}
                className="h-4 w-4 accent-[#ffd800]"
              />
              Gizli hesap
            </label>
            <Button
              size="sm"
              variant="primary"
              className="self-start"
              busy={patch.isPending}
              onClick={async () => {
                const c = await confirmAction({
                  title: 'Profil kaydedilsin mi?',
                  body: 'Kullanıcıya görünür değişiklik.',
                  ok: 'Kaydet',
                  note: 'optional',
                });
                if (!c.ok) return;
                const body: ProfilePatch = { ...form, note: c.note };
                if (body.username === u.username) delete body.username;
                if (body.displayName === (u.displayName ?? '')) delete body.displayName;
                else if (body.displayName === '') body.displayName = null;
                patch.mutate([body]);
              }}
            >
              Kaydet
            </Button>
          </Section>

          <Section title="Hesap türü" hint="Resmi hesap sarı tik alır (elle verilmiş tik varsa o korunur).">
            <Segment
              value={u.accountType}
              disabled={type.isPending}
              items={ACCOUNT_TYPES}
              onChange={async (t) => {
                const c = await confirmAction({
                  title: `Hesap türü: ${ACCOUNT_TYPES.find((x) => x.key === t)?.label}`,
                  body: 'Tik ve güvenilirlik yeniden hesaplanır.',
                  ok: 'Değiştir',
                  note: 'optional',
                });
                if (c.ok) type.mutate([t, c.note]);
              }}
            />
          </Section>

          <Section
            title="Güvenilir hesap"
            hint="Otomatik: takipçi eşiği ve sağlık denetimine göre. Elle verilen karar otomatik kademe tarafından değiştirilmez."
          >
            <Segment
              value={acc.isLoading ? null : trustMode}
              disabled={trusted.isPending || acc.isLoading}
              items={[
                { key: 'auto', label: 'Otomatik' },
                { key: 'yes', label: 'Güvenilir' },
                { key: 'no', label: 'Değil' },
              ]}
              onChange={(k) => trusted.mutate([k === 'auto' ? null : k === 'yes'])}
            />
            <p className="text-[12.5px] text-sub">Şu an: {u.isTrusted ? 'güvenilir' : 'güvenilir değil'}</p>
          </Section>
        </>
      )}
    </div>
  );
}

// ---------------- Hesap ----------------
export function AccountTab({ u }: { u: UserDetail }) {
  const isAdmin = useIsAdmin();
  const q = useQuery({ queryKey: ['admin', 'account', u.id], queryFn: () => adminApi.account(u.id) });
  const reset = useAct(u, (note: string) => adminApi.passwordReset(u.id, note), 'Sıfırlama kodu kullanıcının e-postasına gönderildi');
  const revoke = useAct(
    u,
    (family: string | undefined, note: string) => adminApi.revokeSessions(u.id, family, note),
    (r) => `${(r as { revoked: number }).revoked} oturum kapatıldı`,
  );
  const device = useAct(u, (id: string) => adminApi.removeDevice(u.id, id), 'Cihaz kaldırıldı');
  const email = useAct(u, (a: 'mark_verified' | 'resend') => adminApi.email(u.id, a), 'Tamam');
  const del = useAct(u, (note: string) => adminApi.deletion(u.id, 'request', note), 'Silme talebi başlatıldı');

  if (q.isLoading) return <Rows n={5} />;
  if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const a = q.data!;
  return (
    <div className="flex flex-col gap-6 px-[18px] pt-1 pb-6">
      <Section title="E-posta">
        <div className="flex flex-wrap items-center gap-2">
          {a.emailVerified ? <Tag tone="up">Doğrulanmış</Tag> : <Tag tone="yellow">Doğrulanmadı</Tag>}
          {isAdmin && !a.emailVerified && (
            <>
              <Button size="sm" variant="outline" busy={email.isPending} onClick={() => email.mutate(['resend'])}>
                Kodu yeniden gönder
              </Button>
              <Button size="sm" variant="outline" busy={email.isPending} onClick={() => email.mutate(['mark_verified'])}>
                Doğrulanmış say
              </Button>
            </>
          )}
        </div>
      </Section>

      {isAdmin && (
        <Section title="Şifre" hint="6 haneli kod kullanıcının e-postasına gider; kodu kimse panelde görmez.">
          <Button
            size="sm"
            variant="outline"
            className="self-start"
            disabled={u.isBanned}
            busy={reset.isPending}
            onClick={async () => {
              const c = await confirmAction({
                title: 'Şifre sıfırlama gönderilsin mi?',
                body: `Kod ${u.email ?? 'kullanıcının e-postasına'} gönderilir.`,
                ok: 'Gönder',
                note: 'optional',
              });
              if (c.ok) reset.mutate([c.note]);
            }}
          >
            {a.hasPassword ? 'Sıfırlama kodu gönder' : 'Şifre oluşturma kodu gönder'}
          </Button>
        </Section>
      )}

      <Section title={`Oturumlar · ${a.sessions.length}`}>
        <div className="overflow-hidden rounded-[14px] bg-elev2">
          {a.sessions.length ? (
            a.sessions.map((s) => (
              <Line key={s.family}>
                <Icon name="lock" size={18} className="text-sub" />
                <div className="min-w-0 flex-1">
                  <p className="truncate">{s.device ?? 'Bilinmeyen cihaz'}</p>
                  <p className="text-[12px] text-faint">
                    son kullanım {timeAgo(s.lastUsedAt)} · başlangıç {timeAgo(s.startedAt)}
                  </p>
                </div>
                <Button size="xs" variant="outline" disabled={revoke.isPending} onClick={() => revoke.mutate([s.family, ''])}>
                  Kapat
                </Button>
              </Line>
            ))
          ) : (
            <Line>
              <span className="text-faint">Açık oturum yok</span>
            </Line>
          )}
        </div>
        {a.sessions.length > 0 && (
          <Button
            size="sm"
            variant="danger"
            className="self-start"
            busy={revoke.isPending}
            onClick={async () => {
              const c = await confirmAction({
                title: 'Tüm oturumlar kapatılsın mı?',
                body: 'Kullanıcı tüm cihazlardan çıkar ve yeniden giriş yapar. Hesap ele geçirildiyse şifre sıfırlamayı da gönder.',
                ok: 'Hepsini kapat',
                danger: true,
                note: 'optional',
              });
              if (c.ok) revoke.mutate([undefined, c.note]);
            }}
          >
            Tüm oturumları kapat
          </Button>
        )}
      </Section>

      <Section title={`Bildirim cihazları · ${a.devices.length}`}>
        <div className="overflow-hidden rounded-[14px] bg-elev2">
          {a.devices.length ? (
            a.devices.map((d) => (
              <Line key={d.id}>
                <Icon name="notifications" size={18} className="text-sub" />
                <span className="flex-1">
                  {d.platform} · {timeAgo(d.createdAt)}
                </span>
                {isAdmin && (
                  <Button size="xs" variant="outline" disabled={device.isPending} onClick={() => device.mutate([d.id])}>
                    Kaldır
                  </Button>
                )}
              </Line>
            ))
          ) : (
            <Line>
              <span className="text-faint">Kayıtlı cihaz yok</span>
            </Line>
          )}
        </div>
      </Section>

      <Section title="Giriş yöntemleri">
        <div className="overflow-hidden rounded-[14px] bg-elev2">
          <Line>
            <span className="flex-1">Şifre</span>
            <span className="text-sub">{a.hasPassword ? 'var' : 'yok'}</span>
          </Line>
          {a.identities.map((i) => (
            <Line key={i.provider}>
              <span className="flex-1 capitalize">{i.provider}</span>
              <span className="truncate text-sub">{i.email ?? timeAgo(i.createdAt)}</span>
            </Line>
          ))}
        </div>
      </Section>

      {a.linkedAccounts.length > 0 && (
        <Section title="Bağlı hesaplar" hint="Kullanıcının hesap değiştirici ile bağladığı diğer hesapları.">
          <div className="overflow-hidden rounded-[14px] bg-elev2">
            {a.linkedAccounts.map((l) => (
              <Line key={l.id}>
                <Avatar src={l.avatarPath} name={l.displayName ?? l.username} size={24} />
                <span>@{l.username}</span>
              </Line>
            ))}
          </div>
        </Section>
      )}

      {isAdmin && u.role === 'user' && (
        <Section
          title="Hesabı sil"
          hint="Hesap hemen gizlenir, oturumlar kapanır; 30 gün sonra kalıcı silinir. Bu sürede geri yüklenebilir."
        >
          <Button
            size="sm"
            variant="danger"
            className="self-start"
            busy={del.isPending}
            onClick={async () => {
              const c = await confirmAction({
                title: `@${u.username} silinsin mi?`,
                body: 'KVKK talebi veya kural ihlali için. Gerekçe denetim kaydına yazılır.',
                ok: 'Silme talebini başlat',
                danger: true,
                note: 'required',
              });
              if (c.ok) del.mutate([c.note]);
            }}
          >
            Silme talebini başlat
          </Button>
        </Section>
      )}
    </div>
  );
}

// ---------------- İçerik ----------------
const KINDS: Array<{ key: ContentKind; label: string }> = [
  { key: 'post', label: 'Gönderiler' },
  { key: 'comment', label: 'Yorumlar' },
  { key: 'room', label: 'Odalar' },
  { key: 'quiz', label: 'Quizler' },
  { key: 'story', label: 'Hikâyeler' },
];

export function ContentTab({ u }: { u: UserDetail }) {
  const [kind, setKind] = useState<ContentKind>('post');
  const q = useInfiniteQuery({
    queryKey: ['admin', 'ucontent', u.id, kind],
    queryFn: ({ pageParam }) => adminApi.userContent(u.id, kind, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const hide = useAct(u, (k: 'post' | 'comment' | 'room' | 'story', id: string, note: string) => adminApi.hide(k, id, note), 'Kaldırıldı');
  const restore = useAct(u, (k: 'post' | 'comment' | 'room', id: string) => adminApi.restore(k, id), 'Geri alındı');
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <div className="px-[18px] pb-3">
        <Pills items={KINDS} value={kind} onChange={setKind} />
      </div>
      {q.isLoading ? (
        <Rows n={4} />
      ) : q.isError ? (
        <ErrorState error={q.error} />
      ) : !items.length ? (
        <EmptyState icon="info" title="İçerik yok" />
      ) : (
        items.map((c) => (
          <div key={c.id} className="flex items-start gap-3 px-[18px] py-3 shadow-[inset_0_0.5px_0_var(--color-line)]">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-3 text-[13.5px] break-words">{c.text || <span className="text-faint">Metin yok</span>}</p>
              <p className="mt-0.5 text-[12px] text-faint">
                {c.meta} · {timeAgo(c.createdAt)}
                {c.hidden && <span className="text-live"> · gizli</span>}
              </p>
            </div>
            {(c.kind === 'post' || c.kind === 'comment' || c.kind === 'room') && c.hidden ? (
              <Button size="xs" variant="outline" onClick={() => restore.mutate([c.kind as 'post' | 'comment' | 'room', c.id])}>
                Geri al
              </Button>
            ) : c.kind !== 'quiz' && !c.hidden ? (
              <Button
                size="xs"
                variant="danger"
                onClick={async () => {
                  const cf = await confirmAction({
                    title: 'Kaldırılsın mı?',
                    body: 'Sahibine gerekçeli bildirim gider.',
                    ok: 'Kaldır',
                    danger: true,
                    note: 'optional',
                  });
                  if (cf.ok) hide.mutate([c.kind as 'post' | 'comment' | 'room' | 'story', c.id, cf.note]);
                }}
              >
                {c.kind === 'room' ? 'Arşivle' : 'Kaldır'}
              </Button>
            ) : null}
          </div>
        ))
      )}
      {q.hasNextPage && (
        <div className="flex justify-center p-4">
          <Button size="sm" variant="outline" busy={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
            Daha fazla
          </Button>
        </div>
      )}
    </>
  );
}

// ---------------- Bağlantılar ----------------
export function RelationsTab({ u }: { u: UserDetail }) {
  const [kind, setKind] = useState<RelationKind>('followers');
  const q = useQuery({ queryKey: ['admin', 'relations', u.id, kind], queryFn: () => adminApi.relations(u.id, kind) });
  return (
    <>
      <div className="px-[18px] pb-3">
        <Pills
          items={[
            { key: 'followers', label: 'Takipçiler' },
            { key: 'following', label: 'Takip ettikleri' },
            { key: 'blocks', label: 'Engelledikleri' },
          ]}
          value={kind}
          onChange={setKind}
        />
      </div>
      {q.isLoading ? (
        <Rows n={4} />
      ) : q.isError ? (
        <ErrorState error={q.error} />
      ) : !q.data?.items.length ? (
        <EmptyState icon="groups" title="Kimse yok" />
      ) : (
        <>
          <p className="px-[18px] pb-2 text-[12px] text-faint">
            Toplam {fmt(q.data.total)}
            {q.data.total > q.data.items.length && ` · son ${q.data.items.length} gösteriliyor`}
          </p>
          {q.data.items.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-[18px] py-2.5 shadow-[inset_0_0.5px_0_var(--color-line)]">
              <Avatar src={r.avatarPath} name={r.displayName ?? r.username} size={30} />
              <div className="min-w-0 flex-1 text-[13.5px]">
                <p className="flex items-center gap-1.5 font-semibold">
                  {r.displayName ?? r.username}
                  <Tick tick={r.tick} size={12} />
                </p>
                <p className="text-[12px] text-sub">@{r.username}</p>
              </div>
              <span className="text-[11.5px] text-faint">{timeAgo(r.since)}</span>
            </div>
          ))}
        </>
      )}
    </>
  );
}
