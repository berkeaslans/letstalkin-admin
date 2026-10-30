// Analiz · Kayıt kaynakları: yeni kayıtlar nereden geldi. Kanal (Google, X, Instagram, WhatsApp,
// paylaşılan uygulama linki…), yönlendiren site, açılış sayfası, kampanya (UTM), platform ve
// geldikten sonra uygulamayı kullanmaya başlayanlar (etkinleşme). Kaynak: backend SignupSource.
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Delta, HBars } from '@/components/ui/Chart';
import { Card, ErrorState, Rows, Stat, Tag } from '@/components/ui/misc';
import { Segment } from '@/components/ui/Tabs';
import { adminApi, type Signups as Data } from '@/lib/api/admin';
import { cn } from '@/lib/cn';
import { fmt } from '@/lib/format';
import { go, paths } from '@/lib/go';

const DAYS = [
  { key: '7', label: '7 gün' },
  { key: '30', label: '30 gün' },
  { key: '90', label: '90 gün' },
] as const;
type Days = (typeof DAYS)[number]['key'];

/** Kanal adı + grafik rengi (yığılmış günlük çubukta ve noktalarda). */
const CHANNEL: Record<string, { label: string; color: string }> = {
  google: { label: 'Google arama', color: '#4C8DF6' },
  share: { label: 'Paylaşılan link', color: '#FFD800' },
  whatsapp: { label: 'WhatsApp', color: '#30D46B' },
  instagram: { label: 'Instagram', color: '#E1306C' },
  x: { label: 'X (Twitter)', color: '#E7E9EA' },
  tiktok: { label: 'TikTok', color: '#25F4EE' },
  facebook: { label: 'Facebook', color: '#1877F2' },
  telegram: { label: 'Telegram', color: '#2AABEE' },
  youtube: { label: 'YouTube', color: '#FF3B4E' },
  reddit: { label: 'Reddit', color: '#FF5700' },
  eksisozluk: { label: 'Ekşi Sözlük', color: '#81C14B' },
  ai: { label: 'Yapay zekâ (ChatGPT, Perplexity…)', color: '#9B5CFF' },
  search: { label: 'Diğer arama motorları', color: '#7FA7E8' },
  linkedin: { label: 'LinkedIn', color: '#0A66C2' },
  discord: { label: 'Discord', color: '#5865F2' },
  direct: { label: 'Doğrudan (adres yazıp)', color: '#828489' },
  app: { label: 'Mobil uygulama', color: '#F1ECB4' },
  other: { label: 'Diğer siteler', color: '#505257' },
  unknown: { label: 'Bilinmiyor (takip öncesi)', color: '#2a2a2e' },
};
const ch = (k: string | null) => CHANNEL[k ?? 'unknown'] ?? { label: k ?? '—', color: '#505257' };

const KIND: Record<string, string> = {
  home: 'Ana sayfa',
  post: 'Gönderi',
  stats: 'İzleme istatistikleri',
  profile: 'Profil',
  room: 'Oda',
  invite: 'Oda daveti',
  quiz: 'Quiz',
  title: 'Dizi/film/bölüm sayfası',
  signup: 'Doğrudan kayıt sayfası',
  other: 'Diğer sayfa',
};
const PLATFORM: Record<string, string> = { web: 'Web', ios: 'iOS', android: 'Android' };
const METHOD: Record<string, string> = { email: 'E-posta', google: 'Google', apple: 'Apple' };
const INAPP: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  x: 'X',
  snapchat: 'Snapchat',
  linkedin: 'LinkedIn',
  telegram: 'Telegram',
};

const when = (d: string) => new Date(d).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const wait = (m: number | null) =>
  m == null ? '—' : m < 60 ? `${m} dk` : m < 1440 ? `${Math.round(m / 60)} sa` : `${Math.round(m / 1440)} g`;

/** Günlük kayıtlar, kanala göre yığılmış. */
function StackedDaily({ data }: { data: Data['daily'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.total));
  const h = hover != null ? data[hover] : null;
  const dayLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  return (
    <div className="flex flex-col gap-2">
      <div className="min-h-[20px] text-[12px] text-sub">
        {h ? (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <b className="text-[14px] text-text">
              {dayLabel(h.day)} · {fmt(h.total)} kayıt
            </b>
            {Object.entries(h.channels)
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) => (
                <span key={k} className="flex items-center gap-1">
                  <i className="block h-2 w-2 rounded-full" style={{ background: ch(k).color }} />
                  {ch(k).label} {n}
                </span>
              ))}
          </span>
        ) : (
          'Bir günün üstüne gel: o gün hangi kanaldan kaç kayıt'
        )}
      </div>
      <div className="flex h-[150px] items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <button
            type="button"
            key={d.day}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            aria-label={`${dayLabel(d.day)}: ${d.total} kayıt`}
            className="flex h-full min-w-0 flex-1 flex-col justify-end"
          >
            <span
              className={cn(
                'flex w-full flex-col-reverse overflow-hidden rounded-t-[4px]',
                hover === i && 'outline outline-1 outline-white/40',
              )}
              style={{
                height: `${(d.total / max) * 100}%`,
                minHeight: d.total ? 3 : 1,
                background: d.total ? undefined : 'rgb(255 255 255 / 0.06)',
              }}
            >
              {Object.entries(d.channels).map(([k, n]) => (
                <i key={k} className="block w-full" style={{ height: `${(n / d.total) * 100}%`, background: ch(k).color }} />
              ))}
            </span>
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[10.5px] text-faint">
        <span>{data[0] && dayLabel(data[0].day)}</span>
        <span>{data.at(-1) && dayLabel(data.at(-1)!.day)}</span>
      </div>
    </div>
  );
}

export function Signups() {
  const [days, setDays] = useState<Days>('30');
  const q = useQuery({
    queryKey: ['admin', 'signups', days],
    queryFn: () => adminApi.signups(Number(days)),
    placeholderData: (p) => p,
    refetchInterval: 60_000,
  });
  const picker = (
    <div className="flex justify-end">
      <div className="w-[260px]">
        <Segment value={days} onChange={setDays} items={DAYS.map((x) => ({ key: x.key, label: x.label }))} />
      </div>
    </div>
  );
  if (!q.data)
    return (
      <>
        {picker}
        <Card>{q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : <Rows n={8} />}</Card>
      </>
    );
  const d = q.data;
  const activated = d.channels.reduce((n, c) => n + c.activated, 0);
  const top = d.channels[0];
  const share = d.channels.find((c) => c.key === 'share')?.n ?? 0;

  return (
    <>
      {picker}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat
          icon="person"
          label="Yeni kayıt"
          value={
            <span className="flex items-baseline gap-2">
              {fmt(d.total)} <Delta now={d.total} prev={d.prevTotal} />
            </span>
          }
          sub={`son ${days} gün · önceki dönem ${fmt(d.prevTotal)}`}
          tone="up"
        />
        <Stat
          icon="trending_up"
          label="En çok getiren"
          value={top ? ch(top.key).label : '—'}
          sub={top && d.tracked ? `kayıtların %${Math.round((top.n / d.tracked) * 100)}'i · ${fmt(top.n)} kişi` : undefined}
        />
        <Stat icon="group" label="Paylaşılan linkten" value={fmt(share)} sub="gönderi, profil, istatistik, oda linkleri" />
        <Stat
          icon="bolt"
          label="Etkinleşen"
          value={d.tracked ? `%${Math.round((activated / d.tracked) * 100)}` : '—'}
          sub="kayıttan sonra liste oluşturan ya da paylaşan"
        />
      </div>

      <Card title="Günlük kayıtlar" sub="kanala göre">
        <div className="px-[18px] pb-5">
          <StackedDaily data={d.daily} />
        </div>
      </Card>

      <div className="grid items-start gap-3.5 lg:grid-cols-2">
        <Card title="Kanallar" sub={`kaynağı bilinen ${fmt(d.tracked)} kayıt`}>
          <div className="flex flex-col gap-3 px-[18px] pb-5">
            {d.channels.length ? (
              d.channels.map((c) => (
                <div key={c.key} className="flex flex-col gap-1">
                  <div className="flex items-baseline gap-2 text-[13px]">
                    <i className="block h-2.5 w-2.5 flex-none rounded-full" style={{ background: ch(c.key).color }} />
                    <span className="min-w-0 flex-1 truncate">{ch(c.key).label}</span>
                    <span className="text-[11.5px] text-faint">%{Math.round((c.activated / Math.max(1, c.n)) * 100)} etkinleşti</span>
                    <b className="w-10 text-right tabular">{fmt(c.n)}</b>
                  </div>
                  <div className="h-[6px] overflow-hidden rounded-full bg-white/6">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(c.n / (top?.n || 1)) * 100}%`, background: ch(c.key).color }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-faint">Bu dönemde kaynağı kaydedilmiş kayıt yok.</p>
            )}
          </div>
        </Card>
        <Card title="Hangi sayfadan girdi" sub="ilk açılan sayfa">
          <div className="flex flex-col gap-4 px-[18px] pb-5">
            <HBars rows={d.landingKinds.map((k) => ({ key: k.key, label: KIND[k.key] ?? k.key, value: k.n }))} />
            {!!d.landings.length && (
              <div>
                <p className="mb-2 text-[12px] font-semibold text-sub">En çok kayıt getiren sayfalar</p>
                {d.landings.slice(0, 8).map((l) => (
                  <a
                    key={l.key}
                    href={`https://letstalkin.com${l.key}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 py-1.5 text-[12.5px] shadow-[inset_0_0.5px_0_var(--color-line)] hover:text-yellow"
                  >
                    <span className="truncate">{l.key}</span>
                    <b className="tabular">{fmt(l.n)}</b>
                  </a>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid items-start gap-3.5 lg:grid-cols-3">
        <Card title="Yönlendiren siteler">
          <div className="px-[18px] pb-5">
            {d.referrers.length ? (
              <HBars rows={d.referrers.map((r) => ({ key: r.key, label: r.key, value: r.n }))} />
            ) : (
              <p className="text-[13px] text-faint">—</p>
            )}
          </div>
        </Card>
        <Card title="Kampanyalar" sub="UTM etiketli linkler">
          {d.campaigns.length ? (
            d.campaigns.map((c) => (
              <div
                key={`${c.source}|${c.medium}|${c.campaign}`}
                className="flex items-center justify-between gap-3 px-[18px] py-2 text-[13px] shadow-[inset_0_0.5px_0_var(--color-line)]"
              >
                <span className="min-w-0 truncate">
                  <b>{c.campaign ?? '—'}</b>
                  <span className="text-faint"> · {[c.source, c.medium].filter(Boolean).join(' / ') || '—'}</span>
                </span>
                <b className="tabular">{fmt(c.n)}</b>
              </div>
            ))
          ) : (
            <p className="px-[18px] pb-4 text-[13px] text-faint">
              Henüz yok. Paylaştığın linklere <code className="text-sub">?utm_source=instagram&amp;utm_campaign=lansman</code> eklersen
              burada görünür.
            </p>
          )}
        </Card>
        <Card title="Platform ve giriş">
          <div className="flex flex-col gap-4 px-[18px] pb-5">
            <div className="flex flex-wrap gap-1.5">
              {d.platforms.map((p) => (
                <Tag key={p.key}>
                  {PLATFORM[p.key] ?? p.key} · {fmt(p.n)}
                </Tag>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {d.methods.map((m) => (
                <Tag key={m.key} tone="blue">
                  {METHOD[m.key] ?? m.key} · {fmt(m.n)}
                </Tag>
              ))}
            </div>
            {!!d.inApp.length && (
              <div>
                <p className="mb-2 text-[12px] font-semibold text-sub">Uygulama içi tarayıcı (linki o uygulamada açtı)</p>
                <div className="flex flex-wrap gap-1.5">
                  {d.inApp.map((a) => (
                    <Tag key={a.key} tone="yellow">
                      {INAPP[a.key] ?? a.key} · {fmt(a.n)}
                    </Tag>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card title="Son kayıtlar" sub="kim, ne zaman, nereden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-faint">
                <th className="px-[18px] py-2 font-semibold">Kişi</th>
                <th className="px-3 py-2 font-semibold">Kanal</th>
                <th className="px-3 py-2 font-semibold">Girdiği sayfa</th>
                <th className="px-3 py-2 font-semibold">Yönlendiren / kampanya</th>
                <th className="px-3 py-2 font-semibold">Platform</th>
                <th className="px-3 py-2 text-right font-semibold">Karar süresi</th>
                <th className="px-[18px] py-2 text-right font-semibold">Etkin</th>
              </tr>
            </thead>
            <tbody>
              {d.recent.map((r) => (
                <tr key={r.userId} className="shadow-[inset_0_0.5px_0_var(--color-line)]">
                  <td className="px-[18px] py-2.5">
                    <button type="button" onClick={() => go(paths.user(r.userId))} className="press flex items-center gap-2.5 text-left">
                      <Avatar src={r.avatarPath} name={r.displayName ?? r.username} size={30} />
                      <span className="min-w-0">
                        <b className="block truncate">@{r.username}</b>
                        <span className="text-[11.5px] text-faint">{when(r.createdAt)}</span>
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      <i className="block h-2 w-2 rounded-full" style={{ background: ch(r.channel).color }} />
                      {ch(r.channel).label}
                    </span>
                  </td>
                  <td className="max-w-[240px] px-3 py-2.5">
                    <span className="block truncate" title={r.landingPath ?? undefined}>
                      {r.landingKind ? (KIND[r.landingKind] ?? r.landingKind) : '—'}
                    </span>
                    {r.landingPath && <span className="block truncate text-[11.5px] text-faint">{r.landingPath}</span>}
                  </td>
                  <td className="max-w-[200px] px-3 py-2.5 text-sub">
                    {/* Yönlendiren göndermeyen kaynaklar (ChatGPT: utm_source=chatgpt.com) utm_source ile görünür. */}
                    <span className="block truncate">
                      {[r.referrer, r.utmSource && r.utmSource !== r.referrer && r.utmSource, r.utmCampaign && `#${r.utmCampaign}`]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-sub">
                    {[
                      r.platform && (PLATFORM[r.platform] ?? r.platform),
                      r.inApp && `${INAPP[r.inApp] ?? r.inApp} içinde`,
                      r.method && METHOD[r.method],
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right text-sub tabular">{wait(r.minutesToSignup)}</td>
                  <td className="px-[18px] py-2.5 text-right">
                    {r.activated ? <Tag tone="up">evet</Tag> : <span className="text-faint">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!d.recent.length && <p className="px-[18px] pb-4 text-[13px] text-faint">Bu dönemde kayıt yok.</p>}
        </div>
      </Card>
      <InviteBoard days={Number(days)} />
      <p className="text-[12px] text-faint">
        Kaynak, kişinin siteye ilk geldiği andan (30 gün içinde) kayıt olduğu ana kadar tarayıcıda tutulur; IP saklanmaz. WhatsApp ve
        Telegram gibi uygulamalar yönlendiren bilgisi göndermediği için paylaşılan uygulama linkiyle (gönderi, profil, istatistik) gelenler
        "Paylaşılan link" sayılır. Takip başlamadan önceki kayıtlar "Bilinmiyor" görünür.
      </p>
    </>
  );
}

/** Kişisel davet bağlantısıyla (?ref=) en çok kişi getirenler; "doğruladı" coin kazandıran sayıdır. */
function InviteBoard({ days }: { days: number }) {
  const q = useQuery({ queryKey: ['admin', 'invites', days], queryFn: () => adminApi.invites(days) });
  const d = q.data;
  return (
    <Card title="Davet liderliği" sub={d ? `bu dönemde davetle ${fmt(d.total)} kayıt` : 'kişisel davet bağlantısıyla gelenler'}>
      {q.isError ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !d ? (
        <Rows n={4} />
      ) : !d.items.length ? (
        <p className="px-[18px] pb-4 text-[13px] text-faint">Bu dönemde davetle gelen yok.</p>
      ) : (
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-faint">
              <th className="px-[18px] py-2 font-semibold">Davet eden</th>
              <th className="px-3 py-2 text-right font-semibold">Katılan</th>
              <th className="px-[18px] py-2 text-right font-semibold">Doğrulayan</th>
            </tr>
          </thead>
          <tbody>
            {d.items.map((r, i) => (
              <tr key={r.id} className="shadow-[inset_0_0.5px_0_var(--color-line)]">
                <td className="px-[18px] py-2.5">
                  <button type="button" onClick={() => go(paths.user(r.id))} className="press flex items-center gap-2 text-left">
                    <span className="w-6 text-faint tabular">{i + 1}</span>
                    <b>@{r.username}</b>
                    {r.founderNo != null && <Tag tone="yellow">#{String(r.founderNo).padStart(4, '0')}</Tag>}
                  </button>
                </td>
                <td className="px-3 py-2.5 text-right tabular">{fmt(r.joined)}</td>
                <td className="px-[18px] py-2.5 text-right font-semibold tabular">{fmt(r.verified)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
