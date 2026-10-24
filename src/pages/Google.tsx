// Google: Analytics 4 (site ziyaretçileri), Search Console (Google aramaları) ve
// AdSense (reklam geliri). Anahtarlar backend ortamındadır; panel yalnız okur.
// Bağlı değilse adım adım kurulum gösterilir — sahte veri yok.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { DailyBars, HBars } from '@/components/ui/Chart';
import { Icon } from '@/components/ui/Icon';
import { Card, ErrorState, Rows, Stat, Tag } from '@/components/ui/misc';
import { Pills, Segment } from '@/components/ui/Tabs';
import { adminApi, type GoogleKeys, type GoogleKeysPatch, type GoogleStatus } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { compact, fmt, timeAgo } from '@/lib/format';
import { toast } from '@/stores/ui';

const DAYS = [
  { key: '7', label: '7 gün' },
  { key: '28', label: '28 gün' },
  { key: '90', label: '90 gün' },
] as const;
type Days = (typeof DAYS)[number]['key'];
type Tab = 'analytics' | 'search' | 'adsense' | 'keys';

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

function Setup({ title, steps, env, onKeys }: { title: string; steps: ReactNode[]; env: string[]; onKeys?: () => void }) {
  return (
    <Card title={title} sub={<Tag>Bağlı değil</Tag>}>
      <ol className="flex list-decimal flex-col gap-2 px-[18px] pb-4 pl-[38px] text-[13.5px] text-sub marker:text-faint">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {onKeys && (
        <div className="px-[18px] pb-4">
          <Button size="sm" variant="primary" icon="settings" onClick={onKeys}>
            Bağlantı sekmesinde gir
          </Button>
          <p className="mt-2 text-[12.5px] text-sub">Google'ın verdiği değerleri panele yapıştırıyorsun; sunucuya dokunmak gerekmez.</p>
        </div>
      )}
      <div className="mx-[18px] mb-5 rounded-[12px] bg-elev2 px-3.5 py-3">
        <p className="mb-1.5 text-[12px] font-semibold text-sub">Sunucudan vermeyi tercih edersen ortam değişkenleri</p>
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

// ---------------- Bağlantı (anahtarlar) ----------------
const kinput =
  'h-10 w-full rounded-option bg-elev2 px-3 font-mono text-[13px] outline-none shadow-[inset_0_0_0_0.5px_var(--color-line2)] placeholder:text-faint focus:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.32)]';
const klabel = 'mb-1 block text-[12.5px] font-semibold';

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <span className={klabel}>{label}</span>
      {children}
      {hint && <p className="mt-1 text-[12px] text-sub">{hint}</p>}
    </div>
  );
}

/** Sır alanı: kayıtlıysa değeri göstermez. Üç durum var — dokunulmadı,
 *  yeni değer giriliyor, ya da silinmek üzere işaretlendi. Boş kaydetmek
 *  kazara silmeye yol açmasın diye silme ayrı ve açık bir eylem. */
function Secret({
  label,
  saved,
  value,
  silinecek,
  onChange,
  onSil,
  hint,
  area,
}: {
  label: string;
  saved: boolean;
  value: string | undefined;
  silinecek: boolean;
  onChange: (v: string | undefined) => void;
  onSil: (v: boolean) => void;
  hint?: ReactNode;
  area?: boolean;
}) {
  return (
    <Field label={label} hint={hint}>
      {value !== undefined ? (
        <div className="flex flex-col gap-1.5">
          {area ? (
            <textarea
              autoFocus
              value={value}
              onChange={(e) => onChange(e.target.value)}
              rows={5}
              className={`${kinput} h-auto py-2.5 leading-snug`}
              placeholder="JSON'un tamamını ya da base64 hâlini yapıştır"
            />
          ) : (
            <input autoFocus value={value} onChange={(e) => onChange(e.target.value)} className={kinput} />
          )}
          <button type="button" className="self-start text-[12px] text-sub hover:text-text" onClick={() => onChange(undefined)}>
            Vazgeç
          </button>
        </div>
      ) : silinecek ? (
        <div className="flex items-center gap-2">
          <Tag tone="live">Kaydedince silinecek</Tag>
          <Button size="xs" variant="ghost" onClick={() => onSil(false)}>
            Vazgeç
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {saved ? <Tag tone="up">Kayıtlı</Tag> : <Tag>Boş</Tag>}
          <Button size="xs" variant="ghost" onClick={() => onChange('')}>
            {saved ? 'Değiştir' : 'Gir'}
          </Button>
          {saved && (
            <Button size="xs" variant="ghost" onClick={() => onSil(true)} title="Ortam değişkenine geri döner">
              Sil
            </Button>
          )}
        </div>
      )}
    </Field>
  );
}

function KeysTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'google', 'keys'], queryFn: adminApi.googleKeys });
  const [form, setForm] = useState<Partial<GoogleKeys>>({});
  const [secrets, setSecrets] = useState<Record<string, string | undefined>>({});
  const [silinecek, setSilinecek] = useState<Record<string, boolean>>({});
  const save = useMutation({
    mutationFn: () => {
      const sirlar: Record<string, string> = {};
      // Boş bırakılan düzenleme "değişiklik yok" demektir; silme ayrı işaretle gelir.
      for (const [k2, v2] of Object.entries(secrets)) if (v2?.trim()) sirlar[k2] = v2.trim();
      for (const [k2, v2] of Object.entries(silinecek)) if (v2) sirlar[k2] = '';
      return adminApi.saveGoogleKeys({ ...form, ...sirlar } as GoogleKeysPatch);
    },
    onSuccess: (r) => {
      toast('Google ayarları kaydedildi', 'success', 'Web sitesi en geç 15 saniyede yeni etiketleri kullanır');
      setForm({});
      setSecrets({});
      setSilinecek({});
      qc.setQueryData(['admin', 'google', 'keys'], r);
      void qc.invalidateQueries({ queryKey: ['admin', 'google', 'status'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  if (q.isError || !q.data) return <Card>{q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : <Rows n={5} />}</Card>;

  const k = q.data.keys;
  const v = <K extends keyof GoogleKeys>(key: K) => form[key] ?? k[key];
  const set =
    <K extends keyof GoogleKeys>(key: K) =>
    (e: { target: { value: string } }) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  const kirli = Object.keys(form).length > 0 || Object.values(secrets).some((x) => !!x?.trim()) || Object.values(silinecek).some(Boolean);

  return (
    <div className="flex flex-col gap-3.5">
      <Card title="Web sitesi etiketleri" sub="sayfa kaynağında görünür, gizli değil">
        <div className="grid gap-4 px-[18px] pb-5 sm:grid-cols-2">
          <Field label="GA4 ölçüm kimliği" hint={<>Analytics → Yönetici → Veri akışları → akışa tıkla. “G-” ile başlar.</>}>
            <input className={kinput} value={v('measurementId')} onChange={set('measurementId')} placeholder="G-XXXXXXXXXX" />
          </Field>
          <Field
            label="Site doğrulama kodu"
            hint={
              <>
                Search Console → Mülk ekle → <b>HTML etiketi</b> yöntemi. Etiketin tamamını değil, yalnız <code>content="…"</code> içindeki
                değeri yapıştır.
              </>
            }
          >
            <input className={kinput} value={v('siteVerification')} onChange={set('siteVerification')} placeholder="abcDEF123..." />
          </Field>
          <Field label="AdSense yayıncı kimliği" hint={<>AdSense → Hesap → Hesap bilgileri. “ca-pub-” ile başlar.</>}>
            <input className={kinput} value={v('adsenseClient')} onChange={set('adsenseClient')} placeholder="ca-pub-0000000000000000" />
          </Field>
          <Field label="ads.txt" hint={<>AdSense → Siteler → ads.txt uyarısındaki satır. letstalkin.com/ads.txt adresinde sunulur.</>}>
            <textarea
              rows={3}
              className={`${kinput} h-auto py-2.5 leading-snug`}
              value={v('adsTxt')}
              onChange={set('adsTxt')}
              placeholder="google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0"
            />
          </Field>
        </div>
      </Card>

      <Card title="Panel raporları" sub="bu ekrandaki grafikler için; yalnız sunucuda kalır">
        <div className="grid gap-4 px-[18px] pb-5 sm:grid-cols-2">
          <Field label="GA4 mülk kimliği" hint={<>Analytics → Yönetici → Mülk ayarları. Yalnız rakam.</>}>
            <input className={kinput} value={v('ga4PropertyId')} onChange={set('ga4PropertyId')} placeholder="412345678" />
          </Field>
          <Field label="Search Console sitesi" hint={<>Alan adı mülkü için “sc-domain:letstalkin.com”, URL mülkü için adresin tamamı.</>}>
            <input
              className={kinput}
              value={v('searchConsoleSite')}
              onChange={set('searchConsoleSite')}
              placeholder="sc-domain:letstalkin.com"
            />
          </Field>
          <Field label="AdSense hesap kimliği" hint={<>“accounts/pub-…” biçiminde.</>}>
            <input
              className={kinput}
              value={v('adsenseAccount')}
              onChange={set('adsenseAccount')}
              placeholder="accounts/pub-0000000000000000"
            />
          </Field>
          <Secret
            label="Servis hesabı JSON"
            saved={q.data.secrets.serviceAccountJson}
            value={secrets.serviceAccountJson}
            silinecek={!!silinecek.serviceAccountJson}
            onChange={(x) => setSecrets((s2) => ({ ...s2, serviceAccountJson: x }))}
            onSil={(x) => setSilinecek((s2) => ({ ...s2, serviceAccountJson: x }))}
            area
            hint={
              <>
                Google Cloud → IAM → Hizmet hesapları → anahtar oluştur (JSON). Sonra o hesabın e-postasını GA4 mülküne <b>Görüntüleyen</b>,
                Search Console mülküne <b>tam</b> yetkiyle ekle.
              </>
            }
          />
          <Secret
            label="AdSense OAuth istemci kimliği"
            saved={q.data.secrets.adsenseClientId}
            value={secrets.adsenseClientId}
            silinecek={!!silinecek.adsenseClientId}
            onChange={(x) => setSecrets((s2) => ({ ...s2, adsenseClientId: x }))}
            onSil={(x) => setSilinecek((s2) => ({ ...s2, adsenseClientId: x }))}
            hint="AdSense servis hesabını desteklemiyor; OAuth gerekiyor."
          />
          <Secret
            label="AdSense OAuth istemci sırrı"
            saved={q.data.secrets.adsenseClientSecret}
            value={secrets.adsenseClientSecret}
            silinecek={!!silinecek.adsenseClientSecret}
            onChange={(x) => setSecrets((s2) => ({ ...s2, adsenseClientSecret: x }))}
            onSil={(x) => setSilinecek((s2) => ({ ...s2, adsenseClientSecret: x }))}
          />
          <Secret
            label="AdSense yenileme token'ı"
            saved={q.data.secrets.adsenseRefreshToken}
            value={secrets.adsenseRefreshToken}
            silinecek={!!silinecek.adsenseRefreshToken}
            onChange={(x) => setSecrets((s2) => ({ ...s2, adsenseRefreshToken: x }))}
            onSil={(x) => setSilinecek((s2) => ({ ...s2, adsenseRefreshToken: x }))}
            hint="OAuth Playground ile adsense.readonly kapsamında alınır."
          />
        </div>
      </Card>

      <div className="flex items-center gap-2">
        <Button variant="primary" busy={save.isPending} disabled={!kirli} onClick={() => save.mutate()}>
          Kaydet
        </Button>
        {kirli && (
          <Button
            variant="ghost"
            onClick={() => {
              setForm({});
              setSecrets({});
              setSilinecek({});
            }}
          >
            Değişiklikleri at
          </Button>
        )}
        <p className="ml-auto text-[12px] text-faint">Sırlar panele geri okunmaz; yalnız kayıtlı olup olmadığı görünür.</p>
      </div>
    </div>
  );
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
            { key: 'keys', label: 'Bağlantı' },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab !== 'keys' && (
          <div className="ml-auto w-[260px]">
            <Segment value={days} onChange={setDays} items={DAYS.map((d) => ({ key: d.key, label: d.label }))} />
          </div>
        )}
      </div>
      {tab === 'analytics' && <AnalyticsTab s={s} days={Number(days)} onKeys={() => setTab('keys')} />}
      {tab === 'search' && <SearchTab s={s} days={Number(days)} onKeys={() => setTab('keys')} />}
      {tab === 'adsense' && <AdsenseTab s={s} days={Number(days)} onKeys={() => setTab('keys')} />}
      {tab === 'keys' && <KeysTab />}
    </>
  );
}

function AnalyticsTab({ s, days, onKeys }: { s: GoogleStatus; days: number; onKeys?: () => void }) {
  const q = useQuery({
    queryKey: ['admin', 'google', 'ga', days],
    queryFn: () => adminApi.googleAnalytics(days),
    enabled: s.analytics.configured,
    retry: false,
  });
  if (!s.analytics.configured)
    return (
      <Setup
        onKeys={onKeys}
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

function SearchTab({ s, days, onKeys }: { s: GoogleStatus; days: number; onKeys?: () => void }) {
  const q = useQuery({
    queryKey: ['admin', 'google', 'sc', days],
    queryFn: () => adminApi.googleSearch(days),
    enabled: s.searchConsole.configured,
    retry: false,
  });
  if (!s.searchConsole.configured)
    return (
      <Setup
        onKeys={onKeys}
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

function AdsenseTab({ s, days, onKeys }: { s: GoogleStatus; days: number; onKeys?: () => void }) {
  const q = useQuery({
    queryKey: ['admin', 'google', 'ads', days],
    queryFn: () => adminApi.googleAdsense(days),
    enabled: s.adsense.configured,
    retry: false,
  });
  if (!s.adsense.configured)
    return (
      <Setup
        onKeys={onKeys}
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
