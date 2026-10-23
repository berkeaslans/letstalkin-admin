// Bildirim gönder (duyuru): kitle seç → kaç kişiye gideceğini gör → telefon
// önizlemesiyle yaz → gönder. Gönderim arka planda; sonuç denetim kaydına düşer.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, EmptyState, Rows } from '@/components/ui/misc';
import { type Audience, adminApi } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { fmt, timeAgo } from '@/lib/format';
import { playSound } from '@/lib/sound';
import { confirmAction, toast } from '@/stores/ui';
import { area, Field, field } from './Publish';

const AUD: Array<{ key: Audience; label: string; desc: string }> = [
  { key: 'all', label: 'Herkes', desc: 'Banlı ve silinmiş hesaplar hariç tüm kullanıcılar' },
  { key: 'active7', label: 'Son 7 gün aktif', desc: 'Geçen hafta uygulamayı açanlar' },
  { key: 'active30', label: 'Son 30 gün aktif', desc: 'Geçen ay uygulamayı açanlar' },
  { key: 'inactive30', label: 'Geri kazan', desc: '30 gündür uygulamaya gelmeyenler' },
  { key: 'yellow', label: 'Sarı tikliler', desc: 'Kurucular, resmi hesaplar, önemli kişiler' },
  { key: 'blue', label: 'Mavi tikliler', desc: 'Doğrulanmış aboneler' },
  { key: 'official', label: 'Dizi sayfaları', desc: 'Resmi ve fan sayfaları' },
  { key: 'staff', label: 'Ekip', desc: 'Moderatörler ve adminler (deneme için ideal)' },
  { key: 'user', label: 'Tek kişi', desc: 'Kullanıcı adıyla tek bir hesaba' },
];
const ROUTES = [
  { v: '', label: 'Bildirimler ekranı (varsayılan)' },
  { v: '/rooms', label: 'Odalar' },
  { v: '/quiz', label: 'Quizler' },
  { v: '/store', label: 'Mağaza' },
  { v: '/explore', label: 'Keşfet' },
  { v: '/settings', label: 'Ayarlar' },
];

export function Broadcast() {
  const qc = useQueryClient();
  const [audience, setAudience] = useState<Audience>('staff');
  const [username, setUsername] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [route, setRoute] = useState('');
  const [custom, setCustom] = useState('');
  const [debounced, setDebounced] = useState(username);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(username.trim()), 350);
    return () => clearTimeout(t);
  }, [username]);
  const count = useQuery({
    queryKey: ['admin', 'audience', audience, debounced],
    queryFn: () => adminApi.audience(audience, audience === 'user' ? debounced : undefined),
    enabled: audience !== 'user' || debounced.length > 1,
    retry: false,
  });
  const history = useQuery({
    queryKey: ['admin', 'audit', 'broadcast'],
    queryFn: () => adminApi.audit({ action: 'broadcast' }),
    refetchInterval: 15_000,
  });
  const finalRoute = route === 'custom' ? custom.trim() : route;
  const send = useMutation({
    mutationFn: () =>
      adminApi.broadcast({
        audience,
        username: audience === 'user' ? username.trim() : undefined,
        title: title.trim(),
        body: body.trim() || undefined,
        route: finalRoute || undefined,
      }),
    onSuccess: (r) => {
      toast(`${fmt(r.queued)} kişiye gönderiliyor`, 'success', 'Bitince geçmişte gönderilen sayıyı görürsün');
      playSound('ok');
      setTitle('');
      setBody('');
      setTimeout(() => qc.invalidateQueries({ queryKey: ['admin', 'audit', 'broadcast'] }), 3000);
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const n = count.data?.count;
  const valid = title.trim().length >= 2 && (audience !== 'user' || n === 1) && (route !== 'custom' || /^\/\S*$/.test(custom.trim()));

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-3.5">
        <Card title="Kime?">
          <div className="grid gap-2 px-[18px] pb-4 sm:grid-cols-3">
            {AUD.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => setAudience(a.key)}
                className={cn(
                  'press flex flex-col items-start gap-0.5 rounded-[14px] px-3.5 py-3 text-left transition-colors',
                  audience === a.key ? 'bg-yellow/12 shadow-[inset_0_0_0_1px_var(--color-yellow)]' : 'bg-elev2 hover:bg-elev3',
                )}
              >
                <span className="text-[13.5px] font-semibold">{a.label}</span>
                <span className="text-[11.5px] leading-snug text-faint">{a.desc}</span>
              </button>
            ))}
          </div>
          {audience === 'user' && (
            <div className="px-[18px] pb-4">
              <input className={field} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@kullaniciadi" />
            </div>
          )}
          <div className="flex items-center gap-2 border-t-[0.5px] border-line px-[18px] py-3 text-[13px]">
            <Icon name="group" size={18} className="text-sub" />
            {count.isFetching ? (
              <span className="text-faint">Hesaplanıyor…</span>
            ) : count.isError ? (
              <span className="text-live">{errorMessage(count.error)}</span>
            ) : n !== undefined ? (
              <span>
                <b className="tabular">{fmt(n)}</b> kişiye gidecek
              </span>
            ) : (
              <span className="text-faint">Kullanıcı adını yaz</span>
            )}
          </div>
        </Card>

        <Card title="Mesaj">
          <form
            className="flex flex-col gap-3.5 px-[18px] pb-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const c = await confirmAction({
                title: `${fmt(n ?? 0)} kişiye bildirim gitsin mi?`,
                body: `"${title.trim()}" — uygulama içi bildirim ve (izin verenlere) push. Geri alınamaz.`,
                ok: 'Gönder',
              });
              if (c.ok) send.mutate();
            }}
          >
            <Field label="Başlık" hint={`${title.length}/120`}>
              <input
                className={field}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder="ör. Final gecesi odası açıldı 🎬"
              />
            </Field>
            <Field label="Metin" hint="İsteğe bağlı · bildirimin ikinci satırı">
              <textarea className={cn(area, 'min-h-[80px]')} value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} />
            </Field>
            <Field label="Dokununca açılacak ekran">
              <select className={field} value={route} onChange={(e) => setRoute(e.target.value)}>
                {ROUTES.map((r) => (
                  <option key={r.v} value={r.v}>
                    {r.label}
                  </option>
                ))}
                <option value="custom">Özel yol…</option>
              </select>
              {route === 'custom' && (
                <input className={field} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="/room/oda-kimligi" />
              )}
            </Field>
            <Button type="submit" variant="primary" icon="campaign" className="self-end" busy={send.isPending} disabled={!valid || !n}>
              Gönder
            </Button>
          </form>
        </Card>
      </div>

      <div className="flex flex-col gap-3.5 lg:sticky lg:top-[76px]">
        <Card title="Önizleme">
          <div className="px-[18px] pb-5">
            <div className="rounded-[22px] bg-[linear-gradient(160deg,#1b1d22,#0b0b0d)] p-3.5 shadow-[inset_0_0_0_0.5px_var(--color-line2)]">
              <p className="mb-6 text-center text-[34px] font-light tabular text-white/85">
                {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <div className="flex gap-2.5 rounded-[16px] bg-white/12 p-3 backdrop-blur">
                <img src="/marka/ikon-koyu.svg" alt="" className="h-8 w-8 flex-none rounded-[8px]" />
                <div className="min-w-0 flex-1">
                  <p className="flex justify-between text-[12px] text-white/60">
                    <span className="font-semibold text-white/80">Let&apos;s Talkin&apos;</span>şimdi
                  </p>
                  <p className="text-[13.5px] font-semibold break-words text-white">{title || 'Başlık'}</p>
                  {body && <p className="line-clamp-3 text-[13px] break-words text-white/80">{body}</p>}
                </div>
              </div>
            </div>
          </div>
        </Card>
        <Card title="Geçmiş">
          {history.isLoading ? (
            <Rows n={3} />
          ) : !history.data?.items.length ? (
            <EmptyState
              icon="campaign"
              title="Henüz duyuru yok"
              body="Gönderdiğin duyurular kaç kişiye ulaştığıyla birlikte burada listelenir."
            />
          ) : (
            history.data.items.slice(0, 12).map((h) => {
              const d = (h.detail ?? {}) as { title?: string; label?: string; sent?: number; queued?: number; username?: string };
              return (
                <div key={h.id} className="flex flex-col gap-0.5 px-[18px] py-2.5 shadow-[inset_0_0.5px_0_var(--color-line)]">
                  <p className="truncate text-[13px] font-semibold">{d.title}</p>
                  <p className="text-[11.5px] text-faint">
                    {d.username ? `@${d.username}` : d.label} · {fmt(d.sent ?? 0)}/{fmt(d.queued ?? 0)} gönderildi · {timeAgo(h.createdAt)}
                  </p>
                </div>
              );
            })
          )}
        </Card>
      </div>
    </div>
  );
}
