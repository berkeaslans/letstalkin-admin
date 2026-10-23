// Analiz (kendi verimiz): özellik kullanımı ve kitle. Google Analytics'e
// bağlı değil; mobil uygulama da aynı backend'i kullandığı için iOS, Android ve
// web birlikte sayılır.
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { DailyBars, Delta, HBars } from '@/components/ui/Chart';
import { Card, ErrorState, Rows, Stat, Tag } from '@/components/ui/misc';
import { Segment } from '@/components/ui/Tabs';
import { type Analytics, adminApi } from '@/lib/api/admin';
import { cn } from '@/lib/cn';
import { compact, fmt } from '@/lib/format';
import { go, paths } from '@/lib/go';

const DAYS = [
  { key: '7', label: '7 gün' },
  { key: '30', label: '30 gün' },
  { key: '90', label: '90 gün' },
] as const;
type Days = (typeof DAYS)[number]['key'];
const PLATFORM: Record<string, string> = { ios: 'iOS', android: 'Android', web: 'Web', other: 'Diğer' };
const LANG: Record<string, string> = {
  tr: 'Türkçe',
  en: 'İngilizce',
  de: 'Almanca',
  ar: 'Arapça',
  es: 'İspanyolca',
  fr: 'Fransızca',
  ru: 'Rusça',
};

function useAnalytics() {
  const [days, setDays] = useState<Days>('30');
  const q = useQuery({
    queryKey: ['admin', 'analytics', days],
    queryFn: () => adminApi.analytics(Number(days)),
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
  return { q, days, picker };
}

function Shell({ q, children }: { q: ReturnType<typeof useAnalytics>['q']; children: (a: Analytics) => React.ReactNode }) {
  if (q.data) return <>{children(q.data)}</>;
  return <Card>{q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : <Rows n={8} />}</Card>;
}

export function Usage() {
  const { q, days, picker } = useAnalytics();
  return (
    <>
      {picker}
      <Shell q={q}>
        {(a) => {
          const groups = [...new Set(a.features.map((f) => f.group))];
          return (
            <>
              <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
                <Stat icon="person" label="Yeni kayıt" value={fmt(a.users.newInPeriod)} sub={`son ${days} gün`} tone="up" />
                <Stat icon="movie" label="Gönderi" value={fmt(a.daily.reduce((n, d) => n + d.posts, 0))} />
                <Stat icon="groups" label="Oda mesajı" value={compact(a.daily.reduce((n, d) => n + d.roomMessages, 0))} />
                <Stat icon="info" label="DM" value={compact(a.daily.reduce((n, d) => n + d.dms, 0))} />
              </div>
              <div className="grid gap-3.5 lg:grid-cols-2">
                <Card title="Günlük etkin kişi" sub="o gün paylaşan, yorumlayan, beğenen ya da mesajlaşan">
                  <div className="px-[18px] pb-5">
                    <DailyBars data={a.daily.map((d) => ({ day: d.day, value: d.active }))} label="kişi" />
                  </div>
                </Card>
                <Card title="Günlük kayıt">
                  <div className="px-[18px] pb-5">
                    <DailyBars data={a.daily.map((d) => ({ day: d.day, value: d.signups }))} label="kayıt" />
                  </div>
                </Card>
                <Card title="Günlük gönderi">
                  <div className="px-[18px] pb-5">
                    <DailyBars data={a.daily.map((d) => ({ day: d.day, value: d.posts }))} label="gönderi" />
                  </div>
                </Card>
                <Card title="Günlük oda mesajı">
                  <div className="px-[18px] pb-5">
                    <DailyBars data={a.daily.map((d) => ({ day: d.day, value: d.roomMessages }))} label="mesaj" />
                  </div>
                </Card>
              </div>
              <Card title="Özellik kullanımı" sub={`son ${days} gün · önceki ${days} günle karşılaştırma`}>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[13.5px]">
                    <thead>
                      <tr className="text-left text-[12px] text-faint">
                        <th className="px-[18px] py-2 font-semibold">Özellik</th>
                        <th className="px-3 py-2 text-right font-semibold">İşlem</th>
                        <th className="px-3 py-2 text-right font-semibold">Değişim</th>
                        <th className="px-3 py-2 text-right font-semibold">Kişi</th>
                        <th className="w-[30%] px-[18px] py-2 font-semibold" />
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((g) => {
                        const rows = a.features.filter((f) => f.group === g);
                        const max = Math.max(1, ...a.features.map((f) => f.count));
                        return [
                          <tr key={g}>
                            <td colSpan={5} className="px-[18px] pt-4 pb-1 text-[11px] font-bold tracking-[0.06em] text-faint uppercase">
                              {g}
                            </td>
                          </tr>,
                          ...rows.map((f) => (
                            <tr key={f.key} className="shadow-[inset_0_0.5px_0_var(--color-line)]">
                              <td className="px-[18px] py-2.5">{f.label}</td>
                              <td className="px-3 py-2.5 text-right font-semibold tabular">{fmt(f.count)}</td>
                              <td className="px-3 py-2.5 text-right">
                                <Delta now={f.count} prev={f.prev} />
                              </td>
                              <td className="px-3 py-2.5 text-right text-sub tabular">{f.users ? fmt(f.users) : '—'}</td>
                              <td className="px-[18px] py-2.5">
                                <div className="h-[6px] overflow-hidden rounded-full bg-white/6">
                                  <div className="h-full rounded-full bg-yellow/80" style={{ width: `${(f.count / max) * 100}%` }} />
                                </div>
                              </td>
                            </tr>
                          )),
                        ];
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
              <div className="grid items-start gap-3.5 lg:grid-cols-2">
                <Card title="En çok beğenilen gönderiler">
                  {a.topPosts.map((p) => (
                    <div key={p.id} className="flex items-start gap-3 px-[18px] py-2.5 shadow-[inset_0_0.5px_0_var(--color-line)]">
                      {p.author && (
                        <button type="button" onClick={() => go(paths.user(p.author!.id))}>
                          <Avatar src={p.author.avatarPath} name={p.author.username} size={28} />
                        </button>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] text-faint">@{p.author?.username}</p>
                        <p className="line-clamp-2 text-[13px]">{p.text || '—'}</p>
                      </div>
                      <span className="text-right text-[12px] text-sub tabular">
                        {fmt(p.likeCount)} beğeni
                        <br />
                        {fmt(p.commentCount)} yorum
                      </span>
                    </div>
                  ))}
                  {!a.topPosts.length && <p className="px-[18px] pb-4 text-[13px] text-faint">Bu dönemde gönderi yok</p>}
                </Card>
                <Card title="En hareketli odalar">
                  <div className="px-[18px] pb-5">
                    {a.topRooms.length ? (
                      <HBars rows={a.topRooms.map((r) => ({ key: r.id, label: r.name, value: r.messages }))} />
                    ) : (
                      <p className="text-[13px] text-faint">Bu dönemde mesaj yok</p>
                    )}
                  </div>
                </Card>
              </div>
            </>
          );
        }}
      </Shell>
    </>
  );
}

export function Audience() {
  const { q, picker } = useAnalytics();
  return (
    <>
      {picker}
      <Shell q={q}>
        {(a) => {
          const u = a.users;
          const sessionTotal = a.platforms.sessions.reduce((n, s) => n + s.sessions, 0);
          return (
            <>
              <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
                <Stat icon="group" label="Toplam kullanıcı" value={fmt(u.total)} sub={`${fmt(u.verifiedEmail)} e-postası doğrulanmış`} />
                <Stat
                  icon="bolt"
                  label="Günlük aktif (DAU)"
                  value={fmt(u.dau)}
                  sub={u.mau ? `aylığın %${Math.round((u.dau / u.mau) * 100)}'i` : undefined}
                  tone="up"
                />
                <Stat icon="trending_up" label="Haftalık aktif (WAU)" value={fmt(u.wau)} />
                <Stat
                  icon="monitoring"
                  label="Aylık aktif (MAU)"
                  value={fmt(u.mau)}
                  sub={u.total ? `toplamın %${Math.round((u.mau / u.total) * 100)}'i` : undefined}
                />
              </div>
              <div className="grid items-start gap-3.5 lg:grid-cols-3">
                <Card title="Platform" sub="dönemde kullanılan oturumlar">
                  <div className="flex flex-col gap-4 px-[18px] pb-5">
                    {a.platforms.sessions.length ? (
                      <HBars
                        rows={a.platforms.sessions.map((s) => ({
                          key: s.platform,
                          label: PLATFORM[s.platform],
                          value: s.sessions,
                          hint: sessionTotal ? `%${Math.round((s.sessions / sessionTotal) * 100)}` : undefined,
                        }))}
                      />
                    ) : (
                      <p className="text-[13px] text-faint">Oturum yok</p>
                    )}
                    {!!a.platforms.devices.length && (
                      <div>
                        <p className="mb-2 text-[12px] font-semibold text-sub">Push kayıtlı cihaz</p>
                        <div className="flex flex-wrap gap-1.5">
                          {a.platforms.devices.map((d) => (
                            <Tag key={d.platform}>
                              {PLATFORM[d.platform] ?? d.platform} · {fmt(d.users)}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
                <Card title="Dil">
                  <div className="px-[18px] pb-5">
                    <HBars rows={a.languages.map((l) => ({ key: l.lang, label: LANG[l.lang] ?? l.lang.toUpperCase(), value: l.users }))} />
                  </div>
                </Card>
                <Card title="Cihazlar" sub="en çok kullanılan">
                  {a.platforms.labels.map((l) => (
                    <div
                      key={l.label}
                      className="flex items-center justify-between px-[18px] py-2 text-[13px] shadow-[inset_0_0.5px_0_var(--color-line)]"
                    >
                      <span className="truncate">{l.label}</span>
                      <span className="text-faint tabular">{fmt(l.sessions)}</span>
                    </div>
                  ))}
                  {!a.platforms.labels.length && <p className="px-[18px] pb-4 text-[13px] text-faint">—</p>}
                </Card>
              </div>
              <Card title="Elde tutma" sub="haftalık kayıt kohortları · bu hafta da uygulamaya gelenlerin oranı">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[13.5px]">
                    <thead>
                      <tr className="text-left text-[12px] text-faint">
                        <th className="px-[18px] py-2 font-semibold">Kayıt haftası</th>
                        <th className="px-3 py-2 text-right font-semibold">Kayıt</th>
                        <th className="px-3 py-2 text-right font-semibold">Son 7 günde aktif</th>
                        <th className="w-[40%] px-[18px] py-2 font-semibold">Oran</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...a.retention].reverse().map((r) => {
                        const pct = r.signups ? Math.round((r.activeLast7 / r.signups) * 100) : 0;
                        return (
                          <tr key={r.week} className="shadow-[inset_0_0.5px_0_var(--color-line)]">
                            <td className="px-[18px] py-2.5">
                              {new Date(`${r.week}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} haftası
                            </td>
                            <td className="px-3 py-2.5 text-right tabular">{fmt(r.signups)}</td>
                            <td className="px-3 py-2.5 text-right tabular">{fmt(r.activeLast7)}</td>
                            <td className="px-[18px] py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-white/6">
                                  <div
                                    className={cn('h-full rounded-full', pct >= 40 ? 'bg-up' : 'bg-yellow/80')}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <b className="w-10 text-right text-[12.5px] tabular">%{pct}</b>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
              <p className="text-[12px] text-faint">
                Bu ekran kendi veritabanımızdan hesaplanır; mobil uygulama da aynı backend'i kullandığı için iOS, Android ve web birlikte
                sayılır. Google Analytics, Search Console ve AdSense verileri hesaplar bağlanınca ayrıca eklenecek.
              </p>
            </>
          );
        }}
      </Shell>
    </>
  );
}
