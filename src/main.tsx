import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ComponentType, StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { NAV } from '@/components/layout/nav';
import { Shell } from '@/components/layout/Shell';
import { ConfirmDialog, Toaster } from '@/components/ui/Overlays';
import { ApiError } from '@/lib/api/client';
import { unlockSoundOnFirstInteraction } from '@/lib/sound';
import { Audit } from '@/pages/Audit';
import { Flags } from '@/pages/Flags';
import { Forbidden, Login } from '@/pages/Login';
import { Content, Match, Rooms, Rules, Summary } from '@/pages/Moderation';
import { Overview } from '@/pages/Overview';
import { Publish, PublishAccounts, Quizzes } from '@/pages/Publish';
import { Reports } from '@/pages/Reports';
import { SeriesPages } from '@/pages/SeriesPages';
import { Soon } from '@/pages/Soon';
import { Ticks } from '@/pages/Ticks';
import { Tv } from '@/pages/Tv';
import { UserDrawer } from '@/pages/UserDrawer';
import { Team, Users } from '@/pages/Users';
import { useIsAdmin, useSession } from '@/stores/session';
import './styles.css';

const PAGES: Record<string, ComponentType> = {
  '/': Overview,
  '/moderasyon': Reports,
  '/moderasyon/icerik': Content,
  '/moderasyon/odalar': Rooms,
  '/moderasyon/eslesme': Match,
  '/moderasyon/kurallar': Rules,
  '/moderasyon/ozet': Summary,
  '/kullanicilar': Users,
  '/kullanicilar/tikler': Ticks,
  '/kullanicilar/sayfalar': SeriesPages,
  '/kullanicilar/ekip': Team,
  '/yayin': Publish,
  '/yayin/quizler': Quizzes,
  '/yayin/hesaplar': PublishAccounts,
  '/sistem': Flags,
  '/sistem/denetim': Audit,
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: true,
      // Yetki/bulunamadı hataları tekrar denenmez; ağ hataları iki kez.
      retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2,
    },
  },
});

function App() {
  const { status, boot } = useSession();
  const isAdmin = useIsAdmin();
  useEffect(() => {
    void boot();
    unlockSoundOnFirstInteraction();
  }, [boot]);

  if (status === 'loading')
    return (
      <div className="grid min-h-dvh place-items-center">
        <img src="/marka/ikon-koyu.svg" alt="" className="h-12 w-12 animate-pulse rounded-full" />
      </div>
    );
  if (status === 'signedOut') return <Login />;
  if (status === 'forbidden') return <Forbidden />;

  return (
    <>
      <Routes>
        <Route path="/tv" element={<Tv />} />
        <Route element={<Shell />}>
          {NAV.flatMap((g) => g.subs).map((s) => {
            const Page = s.soon ? Soon : PAGES[s.to];
            const allowed = isAdmin || !s.admin;
            return <Route key={s.to} path={s.to} element={allowed && Page ? <Page /> : <Navigate to="/" replace />} />;
          })}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <UserDrawer />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <Toaster />
      <ConfirmDialog />
    </QueryClientProvider>
  </StrictMode>,
);
