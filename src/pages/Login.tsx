import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { errorMessage } from '@/lib/api/client';
import { useSession } from '@/stores/session';

const field =
  'h-12 w-full rounded-option bg-elev2 px-4 text-[15px] outline-none shadow-[inset_0_0_0_0.5px_var(--color-line2)] placeholder:text-faint focus:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.32)]';

export function Login() {
  const login = useSession((s) => s.login);
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <form
        className="flex w-full max-w-[380px] flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr('');
          try {
            await login(id.trim(), pw);
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
