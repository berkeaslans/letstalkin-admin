// Yayın · Fan sayfaları: gerçek fan sayfaları için ad ayırma, sistemin yönettiği dizi sayfaları,
// tek kullanımlık sahiplenme kodu (Instagram DM ile gönderilir), gizle/göster ve iletişim takibi (CRM).
// Gerçek bir sayfanın adı ve görseliyle onun yerine paylaşım yapılmaz: ayrılan hesap sahiplenilene kadar boş durur.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, ErrorState, Rows, Tag } from '@/components/ui/misc';
import { adminApi, type FanLead } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { fmt } from '@/lib/format';
import { go, paths } from '@/lib/go';
import { toast } from '@/stores/ui';
import { Field, field } from './Publish';

const STATUS: Record<FanLead['status'], string> = {
  todo: 'Yazılacak',
  contacted: 'Yazıldı',
  talking: 'Konuşuluyor',
  claimed: 'Sahiplendi',
  declined: 'İstemedi',
};

export function FanPages() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'fanpages'], queryFn: adminApi.fanPages });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'fanpages'] });
  const [acc, setAcc] = useState({ username: '', displayName: '', showTmdbId: '', reserved: true });
  const [lead, setLead] = useState({ handle: '', followers: '', showTmdbId: '' });
  const [codes, setCodes] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: () => adminApi.createPageAccount({ ...acc, username: acc.username.trim().toLowerCase() }),
    onSuccess: (r) => {
      toast(`@${r.username} açıldı`);
      setAcc({ username: '', displayName: '', showTmdbId: '', reserved: true });
      refresh();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const code = useMutation({
    mutationFn: (id: string) => adminApi.claimCode(id),
    onSuccess: (r, id) => {
      setCodes((c) => ({ ...c, [id]: r.code }));
      refresh();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const hide = useMutation({
    mutationFn: (v: { id: string; hidden: boolean }) => adminApi.setPageHidden(v.id, v.hidden),
    onSuccess: refresh,
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const addLead = useMutation({
    mutationFn: () =>
      adminApi.createLead({
        handle: lead.handle.trim(),
        followers: lead.followers ? Number(lead.followers) : null,
        showTmdbId: lead.showTmdbId.trim() || null,
      }),
    onSuccess: () => {
      setLead({ handle: '', followers: '', showTmdbId: '' });
      refresh();
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  const setLeadStatus = useMutation({
    mutationFn: (v: { id: string; status: FanLead['status'] }) => adminApi.updateLead(v.id, { status: v.status }),
    onSuccess: refresh,
  });

  if (!q.data) return <Card>{q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : <Rows n={6} />}</Card>;
  const d = q.data;
  return (
    <>
      <Card title="Hesap aç" sub="gerçek fan sayfası için ad ayır ya da görünür dizi sayfası aç">
        <div className="grid gap-3 px-[18px] pb-4 md:grid-cols-4">
          <Field label="Kullanıcı adı">
            <input
              className={field}
              value={acc.username}
              onChange={(e) => setAcc({ ...acc, username: e.target.value })}
              placeholder="breakingbadtr"
            />
          </Field>
          <Field label="Görünen ad">
            <input
              className={field}
              value={acc.displayName}
              onChange={(e) => setAcc({ ...acc, displayName: e.target.value })}
              placeholder="Breaking Bad"
            />
          </Field>
          <Field label="Dizi (TMDB no)">
            <input
              className={field}
              value={acc.showTmdbId}
              onChange={(e) => setAcc({ ...acc, showTmdbId: e.target.value })}
              inputMode="numeric"
              placeholder="1396"
            />
          </Field>
          <Field
            label="Tür"
            hint={
              acc.reserved ? 'Gizli: aranamaz, profil görünmez; sahiplenilince açılır' : 'Görünür, profilde "Let\'s Talkin\' yönetiyor"'
            }
          >
            <select
              className={field}
              value={acc.reserved ? 'reserved' : 'managed'}
              onChange={(e) => setAcc({ ...acc, reserved: e.target.value === 'reserved' })}
            >
              <option value="reserved">Fan sayfası için ayrılmış</option>
              <option value="managed">Sistemin yönettiği dizi sayfası</option>
            </select>
          </Field>
          <div className="md:col-span-4">
            <Button
              variant="primary"
              busy={create.isPending}
              disabled={!acc.username || !acc.displayName || !/^\d+$/.test(acc.showTmdbId)}
              onClick={() => create.mutate()}
            >
              Hesabı aç
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Hesaplar" sub={`${fmt(d.accounts.length)} hesap`}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-faint">
              <th className="px-[18px] py-2 font-semibold">Hesap</th>
              <th className="px-3 py-2 font-semibold">Dizi</th>
              <th className="px-3 py-2 font-semibold">Durum</th>
              <th className="px-[18px] py-2 text-right font-semibold">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {d.accounts.map((a) => (
              <tr key={a.id} className="shadow-[inset_0_0.5px_0_var(--color-line)]">
                <td className="px-[18px] py-2.5">
                  <button type="button" onClick={() => go(paths.user(a.id))} className="press text-left">
                    <b>@{a.username}</b>
                    <span className="block text-[11.5px] text-faint">{fmt(a.followerCount)} takipçi</span>
                  </button>
                </td>
                <td className="px-3 py-2.5 text-sub">{a.showTitle ?? a.showTmdbId ?? '—'}</td>
                <td className="px-3 py-2.5">
                  {a.claimed ? (
                    <Tag tone="up">sahiplenildi</Tag>
                  ) : a.reserved ? (
                    <Tag>{a.managed ? 'gizli' : 'ayrılmış'}</Tag>
                  ) : (
                    <Tag tone="yellow">yönetiliyor</Tag>
                  )}
                  {a.openCodes > 0 && <span className="ml-2 text-[11.5px] text-faint">{a.openCodes} açık kod</span>}
                </td>
                <td className="px-[18px] py-2.5 text-right">
                  {codes[a.id] ? (
                    <code className="rounded-[6px] bg-elev2 px-2 py-1 text-[13px] font-bold tracking-[1px] select-all">{codes[a.id]}</code>
                  ) : (
                    !a.claimed && (
                      <span className="inline-flex gap-2">
                        <Button size="sm" busy={code.isPending && code.variables === a.id} onClick={() => code.mutate(a.id)}>
                          Sahiplenme kodu
                        </Button>
                        {a.managed && (
                          <Button size="sm" onClick={() => hide.mutate({ id: a.id, hidden: !a.reserved })}>
                            {a.reserved ? 'Göster' : 'Gizle'}
                          </Button>
                        )}
                      </span>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!d.accounts.length && <p className="px-[18px] pb-4 text-[13px] text-faint">Henüz hesap yok.</p>}
        <p className="px-[18px] pb-4 text-[12px] text-faint">
          Kod yalnız bir kez gösterilir; 30 gün geçerlidir. Sayfa sahibi letstalkin.com/claim adresinde kodu, e-postasını ve şifresini
          girer; hesap, oda ve sarı tik ona geçer.
        </p>
      </Card>

      <Card title="Fan sayfası takibi" sub="iletişime geçilen sayfalar">
        <div className="flex flex-wrap items-end gap-3 px-[18px] pb-4">
          <Field label="Sayfa (@ad)">
            <input
              className={field}
              value={lead.handle}
              onChange={(e) => setLead({ ...lead, handle: e.target.value })}
              placeholder="@breakingbadtr"
            />
          </Field>
          <Field label="Takipçi">
            <input
              className={field}
              value={lead.followers}
              onChange={(e) => setLead({ ...lead, followers: e.target.value })}
              inputMode="numeric"
            />
          </Field>
          <Field label="Dizi (TMDB no)">
            <input
              className={field}
              value={lead.showTmdbId}
              onChange={(e) => setLead({ ...lead, showTmdbId: e.target.value })}
              inputMode="numeric"
            />
          </Field>
          <Button busy={addLead.isPending} disabled={!lead.handle.trim()} onClick={() => addLead.mutate()}>
            Ekle
          </Button>
        </div>
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            {d.leads.map((l) => (
              <tr key={l.id} className="shadow-[inset_0_0.5px_0_var(--color-line)]">
                <td className="px-[18px] py-2.5">
                  <b>@{l.handle}</b>
                  <span className="ml-2 text-[11.5px] text-faint">{l.platform}</span>
                </td>
                <td className="px-3 py-2.5 text-right text-sub tabular">{l.followers != null ? fmt(l.followers) : '—'}</td>
                <td className="px-3 py-2.5 text-sub">{l.showTmdbId ?? '—'}</td>
                <td className="px-[18px] py-2.5 text-right">
                  <select
                    className={field}
                    value={l.status}
                    onChange={(e) => setLeadStatus.mutate({ id: l.id, status: e.target.value as FanLead['status'] })}
                  >
                    {Object.entries(STATUS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!d.leads.length && <p className="px-[18px] pb-4 text-[13px] text-faint">Henüz kayıt yok.</p>}
      </Card>
    </>
  );
}
