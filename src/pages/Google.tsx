// Google: Analytics 4 (site ziyaretçileri), Search Console (Google aramaları) ve
// AdSense (reklam geliri). Anahtarlar backend ortamındadır; panel yalnız okur.
// Bağlı değilse adım adım kurulum gösterilir — sahte veri yok.
import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { DailyBars, HBars } from '@/components/ui/Chart';
import { Icon } from '@/components/ui/Icon';
import { Card, ErrorState, Rows, Stat, Tag } from '@/components/ui/misc';
import { Pills, Segment } from '@/components/ui/Tabs';
import { adminApi, type GoogleStatus } from '@/lib/api/admin';
import { compact, fmt, timeAgo } from '@/lib/format';

const DAYS = [
  { key: '7', label: '7 gün' },
  { key: '28', label: '28 gün' },
  { key: '90', label: '90 gün' },
] as const;
type Days = (typeof DAYS)[number]['key'];
type Tab = 'analytics' | 'search' | 'adsense';

const CHANNEL: Record<string, string> = {
  'Organic Search': 'Google araması',
  Direct: 'Doğrudan',
  'Organic Social': 'Sosyal medya',
  Referral: 'Yönlendiren site',
  'Paid Search': 'Ücretli arama',
  Email: 'E-posta',
  Unassigned: 'Belirsiz',
};
const DEVICE: Record<string, string> = {
  mobile: 'Mobil',
  desktop: 'Masaüstü',
  tablet: 'Tablet',
  MOBILE: 'Mobil',
  DESKTOP: 'Masaüstü',
  TABLET: 'Tablet',
};
const dur = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} dk ${s % 60} sn` : `${s} sn`);

function Setup({ title, steps, env }: { title: string; steps: ReactNode[]; env: string[] }) {
  return (
    <Card title={title} sub={<Tag>Bağlı değil</Tag>}>
      <ol className="flex list-decimal flex-col gap-2 px-[18px] pb-4 pl-[38px] text-[13.5px] text-sub marker:text-faint">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <div className="mx-[18px] mb-5 rounded-[12px] bg-elev2 px-3.5 py-3">
        <p className="mb-1.5 text-[12px] font-semibold text-sub">Backend ortam değişkenleri</p>
        {env.map((e) => (
          <code key={e} className="block text-[12.5px]">
            {e}
          </code>
        ))}
      </div>
    </Card>
  );
}

function Cached({ at }: { at: string }) {
  return <p className="text-right text-[11.5px] text-faint">Google verisi · {timeAgo(at)} alındı · 15 dk önbellek</p>;
}

export function GooglePage() {
  const status = useQuery({ queryKey: ['admin', 'google', 'status'], queryFn: adminApi.googleStatus });
  const [tab, setTab] = useState<Tab>('analytics');
  const [days, setDays] = useState<Days>('28');
  if (!status.data)
    return <Card>{status.isError ? <ErrorState error={status.error} retry={() => status.refetch()} /> : <Rows n={4} />}</Card>;
  const s = status.data;
  return (
    <>
      <div className="grid gap-3.5 sm:grid-cols-3">
        {(
          [
            [
              'analytics',
              'Google Analytics 4',
              'monitoring',
              s.analytics.configured,
              s.analytics.propertyId ? `Mülk ${s.analytics.propertyId}` : 'Site ziyaretçileri',
            ],
            ['search', 'Search Console', 'search', s.searchConsole.configured, s.searchConsole.site ?? 'Google aramaları'],
            ['adsense', 'AdSense', 'toll', s.adsense.configured, s.adsense.account ?? 'Reklam geliri'],
          ] as const
        ).map(([k, label, icon, ok, sub]) => (
          <button
            type="button"
            key={k}
            onClick={() => setTab(k)}
            className={`press flex items-center gap-3 rounded-card px-[18px] py-4 text-left shadow-[inset_0_0_0_0.5px_var(--color-line)] ${tab === k ? 'bg-elev2 shadow-[inset_0_0_0_1px_var(--color-yellow)]' : 'bg-elev'}`}
          >
            <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-elev3">
              <Icon name={icon} size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold">{label}</span>
              <span className="block truncate text-[12px] text-faint">{sub}</span>
            </span>
            <span className={`h-2.5 w-2.5 rounded-full ${ok ? 'bg-up' : 'bg-faint'}`} title={ok ? 'Bağlı' : 'Bağlı değil'} />
          </button>
        ))}
      </div>
      {s.serviceAccountInvalid && (
        <Card>
          <p className="px-[18px] py-3.5 text-[13px] text-live">
            GOOGLE_SERVICE_ACCOUNT_JSON okunamadı: JSON'un tamamı (ya da base64'ü) olmalı; client_email ve private_key alanları gerekli.
          </p>
        </Card>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Pills
          items={[
            { key: 'analytics', label: 'Analytics' },
            { key: 'search', label: 'Search Console' },
            { key: 'adsense', label: 'AdSense' },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="ml-auto w-[260px]">
          <Segment value={days} onChange={setDays} items={DAYS.map((d) => ({ key: d.key, label: d.label }))} />
        </div>
      </div>
      {tab === 'analytics' && <AnalyticsTab s={s} days={Number(days)} />}
      {tab === 'search' && <SearchTab s={s} days={Number(days)} />}
      {tab === 'adsense' && <AdsenseTab s={s} days={Number(days)} />}
    </>
  );
}

function AnalyticsTab({ s, days }: { s: GoogleStatus; days: number }) {
  const q = useQuery({
    queryKey: ['admin', 'google', 'ga', days],
    queryFn: () => adminApi.googleAnalytics(days),
    enabled: s.analytics.configured,
    retry: false,
  });
  if (!s.analytics.configured)
    return (
      <Setup
        title="Google Analytics 4'ü bağla"
        steps={[
          'Google Cloud Console → IAM → Hizmet hesapları → yeni hesap aç, JSON anahtarı indir.',
          'Google Cloud\'da "Google Analytics Data API"yi etkinleştir.',
          <>
            GA4 → Yönetici → Mülk erişim yönetimi → hizmet hesabının e-postasını <b>Görüntüleyen</b> olarak ekle
            {s.serviceAccount ? ` (${s.serviceAccount})` : ''}.
          </>,
          'GA4 → Yönetici → Mülk ayarları → Mülk kimliğini (yalnız rakam) kopyala.',
          'Web sitesine GA4 ölçüm etiketi (G-XXXX) eklenmiş olmalı; mobil uygulama için Firebase Analytics aynı mülke bağlanır.',
        ]}
        env={['GOOGLE_SERVICE_ACCOUNT_JSON=…', 'GA4_PROPERTY_ID=412345678']}
      />
    );
  if (!q.data) return <Card>{q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : <Rows n={6} />}</Card>;
  const a = q.data;
  return (
    <>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-5">
        <Stat icon="bolt" label="Şu an sitede" value={fmt(a.realtime)} tone="live" />
        <Stat icon="group" label="Kullanıcı" value={compact(a.totals.activeUsers)} sub={`${compact(a.totals.newUsers)} yeni`} />
        <Stat icon="schedule" label="Oturum" value={compact(a.totals.sessions)} sub={`ort. ${dur(a.totals.avgSessionSec)}`} />
        <Stat icon="visibility" label="Sayfa görüntüleme" value={compact(a.totals.pageViews)} />
        <Stat icon="trending_up" label="Etkileşim oranı" value={`%${a.totals.engagementRate}`} />
      </div>
      <Card title="Günlük kullanıcı">
        <div className="px-[18px] pb-5">
          <DailyBars data={a.daily.map((d) => ({ day: d.day, value: d.users }))} label="kullanıcı" />
        </div>
      </Card>
      <div className="grid items-start gap-3.5 lg:grid-cols-3">
        <Card title="Nereden geliyorlar">
          <div className="px-[18px] pb-5">
            <HBars rows={a.channels.map((c) => ({ key: c.key, label: CHANNEL[c.key] ?? c.key, value: c.value }))} />
          </div>
        </Card>
        <Card title="Ülke">
          <div className="px-[18px] pb-5">
            <HBars rows={a.countries.map((c) => ({ key: c.key, label: c.key, value: c.value }))} />
          </div>
        </Card>
        <Card title="Cihaz">
          <div className="px-[18px] pb-5">
            <HBars rows={a.devices.map((c) => ({ key: c.key, label: DEVICE[c.key] ?? c.key, value: c.value }))} />
          </div>
        </Card>
      </div>
      <Card title="En çok görüntülenen sayfalar">
        {a.pages.map((p) => (
          <div key={p.key} className="flex items-center gap-3 px-[18px] py-2 text-[13px] shadow-[inset_0_0.5px_0_var(--color-line)]">
            <code className="min-w-0 flex-1 truncate">{p.key}</code>
            <b className="tabular">{fmt(p.value)}</b>
          </div>
        ))}
      </Card>
      <Cached at={a.cachedAt} />
    </>
  );
}

function SearchTab({ s, days }: { s: GoogleStatus; days: number }) {
  const q = useQuery({
    queryKey: ['admin', 'google', 'sc', days],
    queryFn: () => adminApi.googleSearch(days),
    enabled: s.searchConsole.configured,
    retry: false,
  });
  if (!s.searchConsole.configured)
    return (
      <Setup
        title="Search Console'u bağla"
        steps={[
          'Analytics için açtığın aynı hizmet hesabını kullanabilirsin (yoksa yeni aç, JSON indir).',
          'Google Cloud\'da "Google Search Console API"yi etkinleştir.',
          <>
            Search Console → Ayarlar → Kullanıcılar ve izinler → hizmet hesabının e-postasını <b>Kullanıcı</b> (kısıtlı yeterli) olarak ekle
            {s.serviceAccount ? ` (${s.serviceAccount})` : ''}.
          </>,
          'Alan mülkü kullanıyorsan "sc-domain:letstalkin.app", URL mülkü kullanıyorsan "https://letstalkin.app/" yaz.',
        ]}
        env={['GOOGLE_SERVICE_ACCOUNT_JSON=…', 'SEARCH_CONSOLE_SITE=sc-domain:letstalkin.app']}
      />
    );
  if (!q.data) return <Card>{q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : <Rows n={6} />}</Card>;
  const r = q.data;
  const table = (rows: typeof r.queries, head: string, mono = false) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-left text-[12px] text-faint">
            <th className="px-[18px] py-2 font-semibold">{head}</th>
            <th className="px-3 py-2 text-right font-semibold">Tıklama</th>
            <th className="px-3 py-2 text-right font-semibold">Gösterim</th>
            <th className="px-3 py-2 text-right font-semibold">CTR</th>
            <th className="px-[18px] py-2 text-right font-semibold">Sıra</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.key} className="shadow-[inset_0_0.5px_0_var(--color-line)]">
              <td className="max-w-[380px] truncate px-[18px] py-2">
                {mono ? <code>{x.key.replace(/^https?:\/\/[^/]+/, '')}</code> : x.key}
              </td>
              <td className="px-3 py-2 text-right font-semibold tabular">{fmt(x.clicks)}</td>
              <td className="px-3 py-2 text-right tabular">{fmt(x.impressions)}</td>
              <td className="px-3 py-2 text-right tabular">%{x.ctr}</td>
              <td className="px-[18px] py-2 text-right tabular">{x.position}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat icon="search" label="Tıklama" value={compact(r.totals.clicks)} />
        <Stat icon="visibility" label="Gösterim" value={compact(r.totals.impressions)} />
        <Stat icon="trending_up" label="Tıklama oranı" value={`%${r.totals.ctr}`} />
        <Stat icon="bar_chart" label="Ortalama sıra" value={String(r.totals.position)} />
      </div>
      <Card title="Günlük tıklama" sub={`${r.range.startDate} – ${r.range.endDate} · Google verisi 2-3 gün gecikmeli`}>
        <div className="px-[18px] pb-5">
          <DailyBars data={r.daily.map((d) => ({ day: d.day, value: d.clicks }))} label="tıklama" />
        </div>
      </Card>
      <div className="grid items-start gap-3.5 xl:grid-cols-2">
        <Card title="Aramalar">{table(r.queries, 'Sorgu')}</Card>
        <Card title="Sayfalar">{table(r.pages, 'Sayfa', true)}</Card>
      </div>
      <Cached at={r.cachedAt} />
    </>
  );
}

function AdsenseTab({ s, days }: { s: GoogleStatus; days: number }) {
  const q = useQuery({
    queryKey: ['admin', 'google', 'ads', days],
    queryFn: () => adminApi.googleAdsense(days),
    enabled: s.adsense.configured,
    retry: false,
  });
  if (!s.adsense.configured)
    return (
      <Setup
        title="AdSense'i bağla"
        steps={[
          'AdSense API hizmet hesabını desteklemez; bir kez Google hesabınla izin vermen gerekir.',
          'Google Cloud\'da "AdSense Management API"yi etkinleştir; Kimlik bilgileri → OAuth istemci kimliği → "Masaüstü uygulaması" oluştur.',
          'OAuth Playground (developers.google.com/oauthplayground) → ayarlardan kendi istemci kimliğini gir → "https://www.googleapis.com/auth/adsense.readonly" kapsamını yetkilendir → yenileme token\'ını al.',
          'AdSense → Hesap → Hesap bilgileri → Yayıncı kimliğini (pub-…) "accounts/pub-…" biçiminde yaz.',
          'Web sitesine AdSense kodu eklenmiş ve site onaylanmış olmalı.',
        ]}
        env={['ADSENSE_CLIENT_ID=…', 'ADSENSE_CLIENT_SECRET=…', 'ADSENSE_REFRESH_TOKEN=…', 'ADSENSE_ACCOUNT=accounts/pub-XXXXXXXXXXXXXXXX']}
      />
    );
  if (!q.data) return <Card>{q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : <Rows n={6} />}</Card>;
  const r = q.data;
  const money = (n: number) =>
    `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${r.currency === 'TRY' ? '₺' : (r.currency ?? '')}`;
  return (
    <>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-5">
        <Stat icon="toll" label="Tahmini kazanç" value={money(r.totals.earnings)} tone="up" />
        <Stat icon="visibility" label="Sayfa görüntüleme" value={compact(r.totals.pageViews)} />
        <Stat icon="bar_chart" label="Reklam gösterimi" value={compact(r.totals.impressions)} />
        <Stat icon="bolt" label="Tıklama" value={fmt(r.totals.clicks)} />
        <Stat icon="trending_up" label="Sayfa RPM" value={money(r.totals.rpm)} />
      </div>
      <Card title="Günlük kazanç">
        <div className="px-[18px] pb-5">
          <DailyBars
            data={r.daily.map((d) => ({ day: d.day, value: Math.round(d.earnings) }))}
            label={r.currency === 'TRY' ? '₺' : (r.currency ?? '')}
          />
        </div>
      </Card>
      {!!r.sites.length && (
        <Card title="Alan adına göre">
          <div className="px-[18px] pb-5">
            <HBars rows={r.sites.map((x) => ({ key: x.key, label: x.key, value: x.earnings }))} format={money} />
          </div>
        </Card>
      )}
      <Cached at={r.cachedAt} />
    </>
  );
}
