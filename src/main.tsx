import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ComponentType, lazy, StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { NAV } from '@/components/layout/nav';
import { Palette, ShortcutHelp } from '@/components/layout/Palette';
import { Shell } from '@/components/layout/Shell';
import { ConfirmDialog, Toaster } from '@/components/ui/Overlays';
import { ApiError } from '@/lib/api/client';
import { unlockSoundOnFirstInteraction } from '@/lib/sound';
import { Forbidden, Login } from '@/pages/Login';
import { Overview } from '@/pages/Overview';
import { Tv } from '@/pages/Tv';
import { useIsAdmin, useSession } from '@/stores/session';
import './styles.css';

/** Sayfalar ilk ziyarette yüklenir (ilk açılış hafif kalır). */
function page<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M & string) {
  return lazy(() => load().then((m) => ({ default: m[name] as ComponentType })));
}
const Audience = page(() => import('@/pages/Analytics'), 'Audience');
const Usage = page(() => import('@/pages/Analytics'), 'Usage');
const GooglePage = page(() => import('@/pages/Google'), 'GooglePage');
const Audit = page(() => import('@/pages/Audit'), 'Audit');
const Broadcast = page(() => import('@/pages/Broadcast'), 'Broadcast');
const Showcase = page(() => import('@/pages/Catalog'), 'Showcase');
const ShowPage = page(() => import('@/pages/Catalog'), 'ShowPage');
const Shows = page(() => import('@/pages/Catalog'), 'Shows');
const Events = page(() => import('@/pages/Events'), 'Events');
const Predictions = page(() => import('@/pages/Predictions'), 'Predictions');
const Theories = page(() => import('@/pages/Theories'), 'Theories');
const Recaps = page(() => import('@/pages/Recaps'), 'Recaps');
const NewTitle = page(() => import('@/pages/TitleEditor'), 'NewTitle');
const EditTitle = page(() => import('@/pages/TitleEditor'), 'EditTitle');
const Coins = page(() => import('@/pages/Economy'), 'Coins');
const Market = page(() => import('@/pages/Economy'), 'Market');
const Products = page(() => import('@/pages/Economy'), 'Products');
const Revenue = page(() => import('@/pages/Economy'), 'Revenue');
const StickerPage = page(() => import('@/pages/Economy'), 'StickerPage');
const Stickers = page(() => import('@/pages/Economy'), 'Stickers');
const FeedbackInbox = page(() => import('@/pages/Feedback'), 'FeedbackInbox');
const Flags = page(() => import('@/pages/Flags'), 'Flags');
const LiveFeed = page(() => import('@/pages/Live'), 'LiveFeed');
const LiveNow = page(() => import('@/pages/Live'), 'LiveNow');
const Content = page(() => import('@/pages/Moderation'), 'Content');
const Match = page(() => import('@/pages/Moderation'), 'Match');
const RoomPage = page(() => import('@/pages/Moderation'), 'RoomPage');
const PostPage = page(() => import('@/pages/Moderation'), 'PostPage');
const Rooms = page(() => import('@/pages/Moderation'), 'Rooms');
const Rules = page(() => import('@/pages/Moderation'), 'Rules');
const Summary = page(() => import('@/pages/Moderation'), 'Summary');
const Publish = page(() => import('@/pages/Publish'), 'Publish');
const PublishAccounts = page(() => import('@/pages/Publish'), 'PublishAccounts');
const QuizPage = page(() => import('@/pages/Publish'), 'QuizPage');
const Quizzes = page(() => import('@/pages/Publish'), 'Quizzes');
const Reports = page(() => import('@/pages/Reports'), 'Reports');
const SeriesPages = page(() => import('@/pages/SeriesPages'), 'SeriesPages');
const Settings = page(() => import('@/pages/System'), 'Settings');
const Status = page(() => import('@/pages/System'), 'Status');
const Ticks = page(() => import('@/pages/Ticks'), 'Ticks');
const UserPage = page(() => import('@/pages/UserPage'), 'UserPage');
const Team = page(() => import('@/pages/Team'), 'Team');
const Users = page(() => import('@/pages/Users'), 'Users');

const PAGES: Record<string, ComponentType> = {
  '/': Overview,
  '/canli': LiveNow,
  '/canli/akis': LiveFeed,
  '/moderasyon': Reports,
  '/moderasyon/icerik': Content,
  '/moderasyon/odalar': Rooms,
  '/moderasyon/eslesme': Match,
  '/moderasyon/kurallar': Rules,
  '/moderasyon/ozet': Summary,
  '/moderasyon/geri-bildirim': FeedbackInbox,
  '/kullanicilar': Users,
  '/kullanicilar/tikler': Ticks,
  '/kullanicilar/sayfalar': SeriesPages,
  '/kullanicilar/ekip': Team,
  '/yayin': Publish,
  '/yayin/quizler': Quizzes,
  '/yayin/bildirim': Broadcast,
  '/yayin/hesaplar': PublishAccounts,
  '/katalog': Shows,
  '/katalog/vitrin': Showcase,
  '/yaklasanlar': Events,
  '/yaklasanlar/tahminler': Predictions,
  '/yaklasanlar/teoriler': Theories,
  '/yaklasanlar/ozetler': Recaps,
  '/ekonomi': Revenue,
  '/ekonomi/coin': Coins,
  '/ekonomi/sticker': Stickers,
  '/ekonomi/pazar': Market,
  '/ekonomi/urunler': Products,
  '/analiz': Usage,
  '/analiz/kitle': Audience,
  '/analiz/google': GooglePage,
  '/sistem': Settings,
  '/sistem/bayraklar': Flags,
  '/sistem/durum': Status,
  '/sistem/denetim': Audit,
};

/** Ayrıntı sayfaları: her şey kendi adresinde açılır (paylaşılabilir, geri tuşu çalışır). */
const DETAILS: Array<{ path: string; parent: string; page: ComponentType }> = [
  { path: '/kullanicilar/:id', parent: '/kullanicilar', page: UserPage },
  { path: '/moderasyon/odalar/:id', parent: '/moderasyon/odalar', page: RoomPage },
  { path: '/moderasyon/icerik/:id', parent: '/moderasyon/icerik', page: PostPage },
  { path: '/yayin/quizler/:id', parent: '/yayin/quizler', page: QuizPage },
  { path: '/ekonomi/sticker/:id', parent: '/ekonomi/sticker', page: StickerPage },
  { path: '/katalog/yeni', parent: '/katalog', page: NewTitle },
  { path: '/katalog/:tmdbId', parent: '/katalog', page: ShowPage },
  { path: '/katalog/:tmdbId/duzenle', parent: '/katalog', page: EditTitle },
];

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
    <Routes>
      <Route path="/tv" element={<Tv />} />
      <Route element={<Shell />}>
        {NAV.flatMap((g) => g.subs).map((s) => {
          const Page = PAGES[s.to];
          const allowed = isAdmin || !s.admin;
          return <Route key={s.to} path={s.to} element={allowed && Page ? <Page /> : <Navigate to="/" replace />} />;
        })}
        {DETAILS.map((d) => {
          const parent = NAV.flatMap((g) => g.subs).find((s) => s.to === d.parent);
          const allowed = isAdmin || !parent?.admin;
          const Page = d.page;
          return <Route key={d.path} path={d.path} element={allowed ? <Page /> : <Navigate to="/" replace />} />;
        })}
        {/* Eski adres (Katalog altındaydı). */}
        <Route path="/katalog/etkinlikler" element={<Navigate to="/yaklasanlar" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        {/* Router içinde: palet ve yardım katmanı sayfa geçişi yapabiliyor. */}
        <Palette />
        <ShortcutHelp />
      </BrowserRouter>
      <Toaster />
      <ConfirmDialog />
    </QueryClientProvider>
  </StrictMode>,
);
