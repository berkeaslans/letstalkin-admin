// Sistem: çalışma zamanı ayarları (kayıt, bakım, asgari sürüm, ödüller, eşikler)
// ve servis durumu (veritabanı, Redis, arama, kuyruklar, bakım işleri).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, ErrorState, Rows, Stat, Tag } from '@/components/ui/misc';
import { Switch } from '@/components/ui/Switch';
import { type AppSettings, adminApi, type FailedJob } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { fmt, timeAgo } from '@/lib/format';
import { playSound } from '@/lib/sound';
import { confirmAction, toast } from '@/stores/ui';
import { field } from './Publish';

type Editable = Omit<AppSettings, 'envRoomThresholds'>;

function Row({ title, desc, children }: { title: string; desc?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-[18px] py-4 shadow-[inset_0_0.5px_0_var(--color-line)] sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold">{title}</p>
        {desc && <p className="mt-0.5 text-[12.5px] text-sub">{desc}</p>}
      </div>
      <div className="flex flex-none flex-col gap-2 sm:w-[340px]">{children}</div>
    </div>
  );
}
const num = (v: string) => Number(v.replace(/\D/g, '')) || 0;

export function Settings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'appsettings'], queryFn: adminApi.appSettings });
  const [d, setD] = useState<Editable | null>(null);
  useEffect(() => {
    if (q.data && !d) {
      const { envRoomThresholds: _e, ...rest } = q.data;
      setD(rest);
    }
  }, [q.data, d]);
  const save = useMutation({
    mutationFn: (body: Partial<Editable>) => adminApi.saveAppSettings(body),
    onSuccess: (r) => {
      toast('Ayarlar kaydedildi', 'success', 'Uygulama ve web en geç 15 saniyede görür');
      playSound('ok');
      setD(r);
      qc.invalidateQueries({ queryKey: ['admin', 'appsettings'] });
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  if (!q.data || !d) return <Card>{q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : <Rows n={8} />}</Card>;
  const { envRoomThresholds: env, ...saved } = q.data;
  const dirty = JSON.stringify(saved) !== JSON.stringify(d);
  const versionOk = (v: string) => !v || /^(\d+\.){0,2}\d+$/.test(v);

  return (
    <>
      {d.maintenance.enabled && saved.maintenance.enabled && (
        <div className="flex items-center gap-3 rounded-card bg-live/12 px-[18px] py-3.5 text-[13.5px] shadow-[inset_0_0_0_0.5px_rgb(255_59_78/0.35)]">
          <Icon name="error" size={20} className="text-live" />
          <span className="flex-1">
            <b>Bakım modu açık.</b> Kullanıcılar uygulamayı ve webi kullanamıyor; ekip ve panel çalışıyor.
          </span>
        </div>
      )}
      <Card title="Uygulama">
        <Row title="Yeni kayıtlar" desc="Kapalıyken e-posta, Google ve Apple ile yeni hesap açılamaz. Mevcut kullanıcılar etkilenmez.">
          <div className="flex items-center justify-between rounded-[12px] bg-elev2 px-3.5 py-2.5 text-[13px]">
            {d.registrationOpen ? 'Açık' : 'Kapalı'}
            <Switch checked={d.registrationOpen} onChange={(v) => setD({ ...d, registrationOpen: v })} label="Yeni kayıtlar" />
          </div>
        </Row>
        <Row
          title="Bakım modu"
          desc="Açılınca uygulama ve web istekleri bakım mesajıyla durur. Giriş, panel ve ekip hesapları çalışmaya devam eder."
        >
          <div className="flex items-center justify-between rounded-[12px] bg-elev2 px-3.5 py-2.5 text-[13px]">
            {d.maintenance.enabled ? <b className="text-live">Açık</b> : 'Kapalı'}
            <Switch
              checked={d.maintenance.enabled}
              onChange={(v) => setD({ ...d, maintenance: { ...d.maintenance, enabled: v } })}
              label="Bakım modu"
            />
          </div>
          <input
            className={field}
            value={d.maintenance.message}
            onChange={(e) => setD({ ...d, maintenance: { ...d.maintenance, message: e.target.value } })}
            placeholder="Kısa bir bakımdayız, birazdan geri döneceğiz."
            maxLength={300}
          />
        </Row>
        <Row
          title="Asgari uygulama sürümü"
          desc="Bu sürümün altındaki mobil uygulamalar güncelleme ekranı gösterir (/config → app.minVersion). Boş = zorunlu güncelleme yok."
        >
          <div className="grid grid-cols-2 gap-2">
            <input
              className={cn(field, !versionOk(d.minVersion.ios) && 'text-live')}
              value={d.minVersion.ios}
              onChange={(e) => setD({ ...d, minVersion: { ...d.minVersion, ios: e.target.value.trim() } })}
              placeholder="iOS ör. 1.4.0"
            />
            <input
              className={cn(field, !versionOk(d.minVersion.android) && 'text-live')}
              value={d.minVersion.android}
              onChange={(e) => setD({ ...d, minVersion: { ...d.minVersion, android: e.target.value.trim() } })}
              placeholder="Android ör. 1.4.0"
            />
          </div>
          <input
            className={field}
            value={d.minVersion.message}
            onChange={(e) => setD({ ...d, minVersion: { ...d.minVersion, message: e.target.value } })}
            placeholder="Güncelleme mesajı (isteğe bağlı)"
            maxLength={300}
          />
        </Row>
      </Card>

      <Card title="Coin ödülleri" sub="Kim neyle ne kadar kazanır">
        <Row title="Hoş geldin" desc="E-postasını doğrulayan yeni kullanıcıya, bir kez.">
          <input
            className={cn(field, 'tabular')}
            inputMode="numeric"
            value={d.rewards.welcome}
            onChange={(e) => setD({ ...d, rewards: { ...d.rewards, welcome: num(e.target.value) } })}
          />
        </Row>
        <Row title="Günün ilk gönderisi" desc="Her gün ilk paylaşımda.">
          <input
            className={cn(field, 'tabular')}
            inputMode="numeric"
            value={d.rewards.dailyPost}
            onChange={(e) => setD({ ...d, rewards: { ...d.rewards, dailyPost: num(e.target.value) } })}
          />
        </Row>
        <Row title="Quiz katılımı" desc="En az bir soruyu cevaplayan herkese.">
          <input
            className={cn(field, 'tabular')}
            inputMode="numeric"
            value={d.rewards.quizJoin}
            onChange={(e) => setD({ ...d, rewards: { ...d.rewards, quizJoin: num(e.target.value) } })}
          />
        </Row>
        <Row title="Quiz derecesi" desc="1., 2. ve 3.'ye (puanı 0'dan büyükse).">
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <input
                key={i}
                className={cn(field, 'tabular')}
                inputMode="numeric"
                aria-label={`${i + 1}. ödülü`}
                value={d.rewards.quizRank[i]}
                onChange={(e) =>
                  setD({ ...d, rewards: { ...d.rewards, quizRank: d.rewards.quizRank.map((x, j) => (j === i ? num(e.target.value) : x)) } })
                }
              />
            ))}
          </div>
        </Row>
      </Card>

      <Card title="Eşikler">
        <Row
          title="Kalıcı oda açma"
          desc={`Bu kadar takipçisi olan herkes kalıcı oda açabilir. Boş = varsayılan (${fmt(env.permanent)}). Sarı tikli, sayfa ve güvenilir hesaplar her zaman açabilir.`}
        >
          <input
            className={cn(field, 'tabular')}
            inputMode="numeric"
            placeholder={fmt(env.permanent)}
            value={d.roomThresholds.permanent ?? ''}
            onChange={(e) =>
              setD({ ...d, roomThresholds: { ...d.roomThresholds, permanent: e.target.value ? num(e.target.value) : null } })
            }
          />
        </Row>
        <Row title="Geçici oda açma" desc={`Boş = varsayılan (${fmt(env.temporary)}).`}>
          <input
            className={cn(field, 'tabular')}
            inputMode="numeric"
            placeholder={fmt(env.temporary)}
            value={d.roomThresholds.temporary ?? ''}
            onChange={(e) =>
              setD({ ...d, roomThresholds: { ...d.roomThresholds, temporary: e.target.value ? num(e.target.value) : null } })
            }
          />
        </Row>
        <Row title="Otomatik gizleme" desc="Bu kadar farklı kişi şikayet edince gönderi/yorum incelemeye kadar gizlenir. 0 = kapalı.">
          <input
            className={cn(field, 'tabular')}
            inputMode="numeric"
            value={d.autoHideThreshold}
            onChange={(e) => setD({ ...d, autoHideThreshold: Math.min(100, num(e.target.value)) })}
          />
        </Row>
      </Card>

      <div className="sticky bottom-4 z-20 flex justify-end">
        <div
          className={cn(
            'flex items-center gap-3 rounded-full bg-elev3/90 py-2 pr-2 pl-4 shadow-[0_10px_40px_rgb(0_0_0/0.5)] backdrop-blur transition-opacity',
            dirty ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <span className="text-[13px] text-sub">Kaydedilmemiş değişiklik var</span>
          <Button size="sm" variant="ghost" onClick={() => setD(saved)}>
            Geri al
          </Button>
          <Button
            size="sm"
            variant="primary"
            busy={save.isPending}
            disabled={!versionOk(d.minVersion.ios) || !versionOk(d.minVersion.android)}
            onClick={async () => {
              if (d.maintenance.enabled && !saved.maintenance.enabled) {
                const c = await confirmAction({
                  title: 'Bakım modu açılsın mı?',
                  body: 'Tüm kullanıcılar için uygulama ve web hemen durur.',
                  ok: 'Aç',
                  danger: true,
                });
                if (!c.ok) return;
              }
              save.mutate(d);
            }}
          >
            Kaydet
          </Button>
        </div>
      </div>
    </>
  );
}

// ---------------- Durum ----------------
function Check({ label, ok, detail, off }: { label: string; ok: boolean; detail?: string; off?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] bg-elev2 px-3.5 py-3">
      <span className={cn('h-2.5 w-2.5 flex-none rounded-full', off ? 'bg-faint' : ok ? 'ok-dot bg-up' : 'live-dot bg-live')} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold">{label}</span>
        {detail && <span className="block truncate text-[11.5px] text-faint">{detail}</span>}
      </span>
      <span className={cn('text-[12px] font-semibold', off ? 'text-faint' : ok ? 'text-up' : 'text-live')}>
        {off ? 'Kurulmadı' : ok ? 'Çalışıyor' : 'Sorun'}
      </span>
    </div>
  );
}

function dur(sec: number) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d ? `${d} gün ${h} sa` : h ? `${h} sa ${m} dk` : `${m} dk`;
}

export function Status() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'status'], queryFn: adminApi.status, refetchInterval: 10_000 });
  const [failed, setFailed] = useState<string | null>(null);
  const fj = useQuery({ queryKey: ['admin', 'status', 'failed', failed], queryFn: () => adminApi.failedJobs(failed!), enabled: !!failed });
  const done = (msg: (n: number) => string) => ({
    onSuccess: (r: unknown) => {
      toast(msg((r as { affected?: number }).affected ?? 0));
      playSound('ok');
      qc.invalidateQueries({ queryKey: ['admin', 'status'] });
    },
    onError: (e: unknown) => toast(errorMessage(e), 'error'),
  });
  const op = useMutation({
    mutationFn: ({ key, op }: { key: string; op: 'retry' | 'clean' | 'pause' | 'resume' }) => adminApi.queueOp(key, op),
    ...done((n) => (n ? `${fmt(n)} iş etkilendi` : 'Tamam')),
  });
  const job = useMutation({
    mutationFn: (key: string) => adminApi.runJob(key),
    ...done(() => 'İş kuyruğa alındı; worker birazdan çalıştırır'),
  });
  if (!q.data) return <Card>{q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : <Rows n={8} />}</Card>;
  const s = q.data;
  const c = s.checks;
  const workers = s.queues.reduce((n, x) => n + x.workers, 0);
  const totalFailed = s.queues.reduce((n, x) => n + x.failed, 0);
  return (
    <>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat
          icon="schedule"
          label="API çalışma süresi"
          value={dur(s.process.uptimeSec)}
          sub={`${s.process.env} · Node ${s.process.node}`}
        />
        <Stat icon="monitoring" label="Bellek" value={`${fmt(s.process.rssMb)} MB`} sub={`heap ${fmt(s.process.heapMb)} MB`} />
        <Stat
          icon="bolt"
          label="Worker"
          value={fmt(workers)}
          sub={workers ? 'kuyrukları tüketiyor' : 'hiç worker bağlı değil!'}
          tone={workers ? 'up' : 'live'}
        />
        <Stat icon="error" label="Başarısız iş" value={fmt(totalFailed)} tone={totalFailed ? 'live' : undefined} />
      </div>
      <Card title="Servisler">
        <div className="grid gap-2 px-[18px] pb-5 sm:grid-cols-2 lg:grid-cols-3">
          <Check label="Veritabanı (PostgreSQL)" ok={c.db.ok} detail={c.db.error ?? `${c.db.ms} ms`} />
          <Check label="Redis" ok={c.redis.ok} detail={c.redis.error ?? `${c.redis.ms} ms`} />
          <Check
            label="Arama (Meilisearch)"
            ok={c.search.ok}
            off={!c.search.enabled}
            detail={c.search.enabled ? (c.search.error ?? `${c.search.ms} ms`) : 'Veritabanı araması kullanılıyor'}
          />
          <Check
            label="E-posta (SMTP)"
            ok={c.email.configured}
            off={!c.email.configured}
            detail={c.email.configured ? undefined : 'Doğrulama ve şifre e-postaları gitmiyor'}
          />
          <Check label="Medya depolama (S3)" ok={c.storage.configured} off={!c.storage.configured} />
          <Check
            label="Push (Firebase)"
            ok={c.push.configured}
            off={!c.push.configured}
            detail={c.push.configured ? undefined : 'Telefonlara push gitmiyor; uygulama içi bildirim çalışıyor'}
          />
          <Check label="TMDB" ok={c.tmdb.configured} off={!c.tmdb.configured} />
          <Check label="Yapay zekâ asistanı" ok={c.ai.configured} off={!c.ai.configured} />
          <Check label="Hata izleme (Sentry)" ok={c.errors.configured} off={!c.errors.configured} />
          <Check label="Google ile giriş" ok={c.google.configured} off={!c.google.configured} />
        </div>
      </Card>
      <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card title="Kuyruklar" sub="10 sn'de bir tazelenir">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-[12px] text-faint">
                  <th className="px-[18px] py-2 font-semibold">Kuyruk</th>
                  <th className="px-2 py-2 text-right font-semibold">Bekleyen</th>
                  <th className="px-2 py-2 text-right font-semibold">Çalışan</th>
                  <th className="px-2 py-2 text-right font-semibold">Zamanlı</th>
                  <th className="px-2 py-2 text-right font-semibold">Hata</th>
                  <th className="px-2 py-2 text-right font-semibold">Worker</th>
                  <th className="px-[18px] py-2" />
                </tr>
              </thead>
              <tbody>
                {s.queues.map((x) => (
                  <tr key={x.key} className="shadow-[inset_0_0.5px_0_var(--color-line)]">
                    <td className="px-[18px] py-2.5">
                      <span className="font-semibold">{x.label}</span>
                      {x.paused && (
                        <span className="ml-2">
                          <Tag tone="yellow">Duraklatıldı</Tag>
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular">{fmt(x.waiting)}</td>
                    <td className="px-2 py-2.5 text-right tabular">{fmt(x.active)}</td>
                    <td className="px-2 py-2.5 text-right text-sub tabular">{fmt(x.delayed)}</td>
                    <td className={cn('px-2 py-2.5 text-right tabular', x.failed && 'font-semibold text-live')}>
                      {x.failed ? (
                        <button
                          type="button"
                          className="underline decoration-dotted"
                          onClick={() => setFailed(failed === x.key ? null : x.key)}
                        >
                          {fmt(x.failed)}
                        </button>
                      ) : (
                        0
                      )}
                    </td>
                    <td className={cn('px-2 py-2.5 text-right tabular', !x.workers && 'text-live')}>{x.workers}</td>
                    <td className="px-[18px] py-2.5 text-right whitespace-nowrap">
                      {x.failed > 0 && (
                        <>
                          <Button size="xs" variant="outline" onClick={() => op.mutate({ key: x.key, op: 'retry' })}>
                            Yeniden dene
                          </Button>{' '}
                          <Button size="xs" variant="ghost" onClick={() => op.mutate({ key: x.key, op: 'clean' })}>
                            Temizle
                          </Button>{' '}
                        </>
                      )}
                      <Button size="xs" variant="ghost" onClick={() => op.mutate({ key: x.key, op: x.paused ? 'resume' : 'pause' })}>
                        {x.paused ? 'Sürdür' : 'Duraklat'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {failed && (
            <div className="border-t-[0.5px] border-line px-[18px] py-3">
              <p className="mb-2 text-[12.5px] font-semibold text-sub">Son hatalar · {s.queues.find((x) => x.key === failed)?.label}</p>
              {fj.isLoading ? (
                <Rows n={2} />
              ) : (
                (fj.data ?? []).map((j: FailedJob) => (
                  <div key={j.id} className="py-1.5 text-[12.5px] shadow-[inset_0_-0.5px_0_var(--color-line)]">
                    <code className="text-live">{j.reason || 'neden yok'}</code>
                    <span className="ml-2 text-faint">
                      {j.name} · {j.attempts} deneme · {j.at ? timeAgo(new Date(j.at)) : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </Card>
        <div className="flex flex-col gap-3.5">
          <Card title="Bakım işleri" sub="elle çalıştır">
            {s.jobs.map((j) => (
              <div key={j.key} className="flex items-center gap-3 px-[18px] py-2.5 shadow-[inset_0_0.5px_0_var(--color-line)]">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">{j.label}</p>
                  <p className="text-[11.5px] text-faint">{j.desc}</p>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  busy={job.isPending && job.variables === j.key}
                  onClick={async () => {
                    const c = await confirmAction({ title: `${j.label}?`, body: j.desc, ok: 'Çalıştır' });
                    if (c.ok) job.mutate(j.key);
                  }}
                >
                  Çalıştır
                </Button>
              </div>
            ))}
          </Card>
          <Card title="Kayıtlar">
            <div className="grid grid-cols-2 gap-px bg-line">
              {[
                ['Kullanıcı', s.counts.users],
                ['Gönderi', s.counts.posts],
                ['Oda', s.counts.rooms],
                ['Oda mesajı', s.counts.messages],
                ['DM', s.counts.dms],
                ['Medya', s.counts.media],
              ].map(([k, v]) => (
                <div key={k as string} className="bg-elev px-[18px] py-2.5">
                  <p className="text-[15px] font-bold tabular">{fmt(v as number)}</p>
                  <p className="text-[11.5px] text-faint">{k}</p>
                </div>
              ))}
            </div>
            <p className="px-[18px] py-3 text-[11.5px] text-faint">API sürümü {s.process.version}</p>
          </Card>
        </div>
      </div>
    </>
  );
}
