import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { TwoFactorChallenge } from '@/lib/api/admin';
import { authApi } from '@/lib/api/admin';
import { ApiError, errorMessage } from '@/lib/api/client';
import { useSession } from '@/stores/session';

const field =
  'h-12 w-full rounded-option bg-elev2 px-4 text-[15px] outline-none shadow-[inset_0_0_0_0.5px_var(--color-line2)] placeholder:text-faint focus:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.32)]';

export function Login() {
  const login = useSession((s) => s.login);
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);

  if (challenge) return <SecondStep challenge={challenge} onCancel={() => setChallenge(null)} />;

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <form
        className="flex w-full max-w-[380px] flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr('');
          try {
            const ch = await login(id.trim(), pw);
            if (ch) {
              setPw('');
              setChallenge(ch);
            }
          } catch (x) {
            setErr(errorMessage(x));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="mb-4 flex items-end gap-2.5">
          <img src="/marka/dikey-koyu.svg" alt="Let's Talkin'" className="h-14 w-auto" />
          <span className="mb-2 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] text-yellow uppercase shadow-[inset_0_0_0_0.5px_rgb(255_216_0/0.4)]">
            Yönetim
          </span>
        </div>
        <h1 className="text-[22px] font-bold tracking-[-0.5px]">Ekip girişi</h1>
        <p className="-mt-2 text-[13.5px] text-sub">Let's Talkin' hesabınla gir. Panel yalnız moderatör ve adminlere açılır.</p>
        <input
          className={field}
          autoComplete="username"
          placeholder="E-posta veya kullanıcı adı"
          value={id}
          onChange={(e) => setId(e.target.value)}
          required
        />
        <input
          className={field}
          type="password"
          autoComplete="current-password"
          placeholder="Şifre"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          required
        />
        {err && <p className="text-[13px] font-medium text-live">{err}</p>}
        <Button type="submit" variant="primary" busy={busy} className="h-12 text-[15.5px]">
          Giriş yap
        </Button>
      </form>
    </div>
  );
}

/** Girişin ikinci adımı: doğrulama uygulaması / e-posta kodu ya da kurtarma kodu. */
function SecondStep({ challenge, onCancel }: { challenge: TwoFactorChallenge; onCancel: () => void }) {
  const complete = useSession((s) => s.completeTwoFactor);
  const [recovery, setRecovery] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const clean = code.trim().toLowerCase();
  const ready = recovery ? /^[a-z0-9]{5}-?[a-z0-9]{5}$/.test(clean) : /^\d{6}$/.test(clean);
  const prompt = recovery
    ? 'Kurtarma kodlarından birini gir. Her kod bir kez kullanılır.'
    : challenge.method === 'email'
      ? `${challenge.emailHint ?? 'E-postana'} adresine 6 haneli bir kod gönderdik.`
      : 'Doğrulama uygulamandaki 6 haneli kodu gir.';

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <form
        className="flex w-full max-w-[380px] flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ready) return;
          setBusy(true);
          setErr('');
          try {
            await complete(challenge.challenge, recovery ? 'recovery' : challenge.method, clean);
          } catch (x) {
            if (x instanceof ApiError && x.code === 'two_factor_expired') {
              onCancel();
              return;
            }
            setErr(errorMessage(x));
            setCode('');
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1 className="text-[22px] font-bold tracking-[-0.5px]">İki adımlı doğrulama</h1>
        <p className="-mt-2 text-[13.5px] text-sub">{prompt}</p>
        <input
          className={`${field} ${recovery ? '' : 'text-center text-[22px] font-bold tracking-[0.4em]'}`}
          autoComplete="one-time-code"
          inputMode={recovery ? 'text' : 'numeric'}
          autoCapitalize="none"
          spellCheck={false}
          maxLength={recovery ? 11 : 6}
          placeholder={recovery ? 'xxxxx-xxxxx' : '000000'}
          value={code}
          onChange={(e) => setCode(recovery ? e.target.value : e.target.value.replace(/\D/g, ''))}
          autoFocus
        />
        {err && <p className="text-[13px] font-medium text-live">{err}</p>}
        {note && !err && <p className="text-[13px] text-sub">{note}</p>}
        <Button type="submit" variant="primary" busy={busy} disabled={!ready} className="h-12 text-[15.5px]">
          Doğrula
        </Button>
        <div className="flex flex-wrap justify-between gap-2 text-[13px] font-semibold text-sub">
          {challenge.method === 'email' && !recovery ? (
            <button
              type="button"
              className="hover:text-text"
              onClick={async () => {
                try {
                  await authApi.twoFactorResend(challenge.challenge);
                  setNote('Yeni kod gönderildi.');
                } catch (x) {
                  setErr(errorMessage(x));
                }
              }}
            >
              Kodu tekrar gönder
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="hover:text-text"
            onClick={() => {
              setRecovery((v) => !v);
              setCode('');
              setErr('');
            }}
          >
            {recovery ? 'Doğrulama kodu kullan' : 'Kurtarma kodu kullan'}
          </button>
        </div>
        <button type="button" onClick={onCancel} className="text-[13px] font-semibold text-faint hover:text-text">
          Başka hesapla gir
        </button>
      </form>
    </div>
  );
}

/** Ekip hesabı ama iki adımlı doğrulama kapalı: önce sitede açılması gerekir. */
export function NeedsTwoFactor() {
  const { me, logout, boot } = useSession();
  const site = import.meta.env.VITE_SITE_URL ?? 'https://letstalkin.com';
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div className="flex max-w-[400px] flex-col items-center gap-3">
        <img src="/marka/ikon-koyu.svg" alt="" className="h-14 w-14 rounded-full" />
        <h1 className="text-[20px] font-bold">Önce iki adımlı doğrulamayı aç</h1>
        <p className="text-[13.5px] leading-relaxed text-sub">
          Panel, şifresi çalınan bir ekip hesabı tek başına girmesin diye iki adımlı doğrulama ister. @{me?.username} hesabıyla sitede
          Ayarlar → Güvenlik → İki adımlı doğrulama bölümünden aç, sonra buraya dön.
        </p>
        <p className="select-all rounded-full bg-elev2 px-3 py-1.5 text-[12.5px] text-sub">{site}/settings/security</p>
        <div className="mt-2 flex gap-2">
          <Button variant="primary" onClick={() => void boot()}>
            Açtım, devam et
          </Button>
          <Button onClick={logout}>Çıkış yap</Button>
        </div>
      </div>
    </div>
  );
}

export function Forbidden() {
  const { me, logout } = useSession();
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div className="flex max-w-[380px] flex-col items-center gap-3">
        <img src="/marka/ikon-koyu.svg" alt="" className="h-14 w-14 rounded-full" />
        <h1 className="text-[20px] font-bold">Bu panel ekip içindir</h1>
        <p className="text-[13.5px] text-sub">@{me?.username} hesabının yönetim yetkisi yok. Yetki için bir admin'e yaz.</p>
        <Button onClick={logout}>Başka hesapla gir</Button>
      </div>
    </div>
  );
}
