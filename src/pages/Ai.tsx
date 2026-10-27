// Sistem · Yapay zekâ: sağlayıcı (Claude ya da Gemini), anahtarlar, günlük harcama sınırı ve
// kullanıcı başı günlük hak. Anahtarlar yalnız sunucuda kalır; panel geri okumaz, yalnız "kayıtlı" olduğunu gösterir.
// Özellikleri tek tek açıp kapatmak için Sistem → Özellik bayrakları.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, ErrorState, Rows, Stat, Tag } from '@/components/ui/misc';
import { adminApi } from '@/lib/api/admin';
import { errorMessage } from '@/lib/api/client';
import { toast } from '@/stores/ui';

const kinput =
  'h-10 w-full rounded-option bg-elev2 px-3 font-mono text-[13px] outline-none shadow-[inset_0_0_0_0.5px_var(--color-line2)] placeholder:text-faint focus:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.32)]';

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <span className="mb-1 block text-[12.5px] font-semibold">{label}</span>
      {children}
      {hint && <p className="mt-1 text-[12px] text-sub">{hint}</p>}
    </div>
  );
}

export function Ai() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'ai'], queryFn: adminApi.aiSettings });
  const [key, setKey] = useState('');
  const [gkey, setGkey] = useState('');
  const [gmodel, setGmodel] = useState('');
  const [provider, setProvider] = useState<'claude' | 'gemini'>('claude');
  const [budget, setBudget] = useState('');
  const [limit, setLimit] = useState('');
  useEffect(() => {
    if (q.data) {
      setBudget(String(q.data.dailyBudgetUsd));
      setProvider(q.data.provider);
      setGmodel(q.data.geminiModel);
      setLimit(String(q.data.userDailyLimit));
    }
  }, [q.data]);
  const save = useMutation({
    mutationFn: (body: Parameters<typeof adminApi.saveAiSettings>[0]) => adminApi.saveAiSettings(body),
    onSuccess: (d) => {
      qc.setQueryData(['admin', 'ai'], d);
      setKey('');
      setGkey('');
      toast('Kaydedildi', 'success');
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });
  if (q.isLoading) return <Rows />;
  if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const d = q.data!;
  const pct = d.dailyBudgetUsd > 0 ? Math.min(100, Math.round((d.spentTodayUsd / d.dailyBudgetUsd) * 100)) : 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="Sağlayıcı"
          icon="key"
          value={d.provider === 'gemini' ? 'Gemini' : 'Claude'}
          sub={(d.provider === 'gemini' ? d.hasGeminiKey : d.hasKey) ? 'Anahtar kayıtlı' : 'Anahtar yok · özellikler kapalı'}
        />
        <Stat
          label="Bugünkü harcama"
          icon="payments"
          value={`$${d.spentTodayUsd.toFixed(2)}`}
          sub={`Sınırın %${pct}'i ($${d.dailyBudgetUsd})`}
        />
        <Stat label="Kullanıcı başı günlük hak" icon="person" value={d.userDailyLimit} sub="Özellik başına ayrı sayılır" />
      </div>
      <Card title="Ayarlar">
        <div className="flex flex-col gap-4 px-[18px] pb-[18px]">
          <Field
            label="Kullanılacak yapay zekâ"
            hint="Dizi arkadaşı, spoiler tespiti, özet, arama, asistan ve Ne izlesem gerekçeleri seçilen sağlayıcıyla çalışır."
          >
            <div className="flex gap-2">
              {(['claude', 'gemini'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProvider(p)}
                  className={`h-10 flex-1 rounded-option text-[13.5px] font-semibold ${provider === p ? 'bg-text text-black' : 'bg-elev2 text-sub shadow-[inset_0_0_0_0.5px_var(--color-line2)]'}`}
                >
                  {p === 'claude' ? 'Claude (Anthropic)' : 'Gemini (Google)'}
                </button>
              ))}
            </div>
          </Field>
          <Field
            label="Anthropic (Claude) API anahtarı"
            hint={
              <>
                console.anthropic.com → API Keys. "sk-ant-" ile başlar. Kayıtlı anahtar gösterilmez; değiştirmek için yenisini yaz.{' '}
                {d.keySource === 'panel' && <Tag tone="up">Kayıtlı</Tag>}
              </>
            }
          >
            <input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={d.hasKey ? '••••••••  (değiştirmek için yeni anahtar)' : 'sk-ant-…'}
              className={kinput}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Gemini API anahtarı"
              hint={<>aistudio.google.com → Get API key. Kayıtlı anahtar gösterilmez. {d.hasGeminiKey && <Tag tone="up">Kayıtlı</Tag>}</>}
            >
              <input
                type="password"
                autoComplete="off"
                value={gkey}
                onChange={(e) => setGkey(e.target.value)}
                placeholder={d.hasGeminiKey ? '••••••••  (değiştirmek için yeni anahtar)' : 'AIza…'}
                className={kinput}
              />
            </Field>
            <Field label="Gemini modeli" hint="Önerilen: gemini-flash-latest (hep güncel Flash). Eski sürüm adı kapatılırsa sistem otomatik buna geçer.">
              <input value={gmodel} onChange={(e) => setGmodel(e.target.value.trim())} className={kinput} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Günlük harcama sınırı (USD)"
              hint="Aşılınca yapay zekâ özellikleri ertesi güne kadar &quot;kapasite doldu&quot; der. Anthropic / Google konsolunda da aylık sınır koymanı öneririz."
            >
              <input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} className={kinput} />
            </Field>
            <Field label="Kullanıcı başı günlük hak" hint="Dizi arkadaşı, özet ve aramanın her biri için ayrı.">
              <input inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value)} className={kinput} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              busy={save.isPending}
              onClick={() =>
                save.mutate({
                  provider,
                  ...(gmodel ? { geminiModel: gmodel } : {}),
                  ...(gkey.trim() ? { geminiApiKey: gkey.trim() } : {}),
                  ...(key.trim() ? { anthropicApiKey: key.trim() } : {}),
                  dailyBudgetUsd: Number(budget),
                  userDailyLimit: Math.round(Number(limit)),
                })
              }
            >
              Kaydet
            </Button>
            {d.keySource === 'panel' && (
              <Button variant="ghost" busy={save.isPending} onClick={() => save.mutate({ anthropicApiKey: '' })}>
                Claude anahtarını sil
              </Button>
            )}
            {d.hasGeminiKey && (
              <Button variant="ghost" busy={save.isPending} onClick={() => save.mutate({ geminiApiKey: '', provider: 'claude' })}>
                Gemini anahtarını sil
              </Button>
            )}
          </div>
        </div>
      </Card>
      <p className="text-[12.5px] text-faint">
        Özellikler (asistan, dizi arkadaşı, spoiler tespiti, özet, arama) Sistem → Özellik bayraklarından tek tek açılıp kapanır. Anahtar
        yoksa hepsi kapalı sayılır.
      </p>
    </div>
  );
}
