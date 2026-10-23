import type { IconName } from '@/components/ui/icon-names';

export interface NavSub {
  to: string;
  label: string;
  desc: string;
  /** Yalnız admin görür (moderatörden gizlenir). */
  admin?: boolean;
  /** Backend ucu henüz yok: sayfa yol haritasını gösterir. */
  soon?: boolean;
  /** Sekme sayacının anahtarı (genel bakış verisinden). */
  count?: 'openReports' | 'pendingVerifications' | 'pendingSeriesPages';
}
export interface NavGroup {
  key: string;
  icon: IconName;
  label: string;
  subs: NavSub[];
  live?: boolean;
  count?: NavSub['count'][];
}

// Prototipteki 9 başlık. Alt sayfalar sayfa üstünde sarı çizgili sekme olarak durur.
export const NAV: NavGroup[] = [
  {
    key: 'genel',
    icon: 'grid_view',
    label: 'Genel bakış',
    subs: [{ to: '/', label: 'Genel bakış', desc: 'Bugün, şu an, bekleyen işler' }],
  },
  {
    key: 'canli',
    icon: 'bolt',
    label: 'Canlı',
    live: true,
    subs: [{ to: '/canli', label: 'Odalar ve yayınlar', desc: 'Aktif odalar, yayınlar ve quizler', soon: true }],
  },
  {
    key: 'mod',
    icon: 'shield',
    label: 'Moderasyon',
    count: ['openReports'],
    subs: [
      { to: '/moderasyon', label: 'Şikayetler', desc: 'Topluluk bildirimleri', count: 'openReports' },
      { to: '/moderasyon/icerik', label: 'İçerik', desc: 'Gönderi ve yorum arama, kaldırma, geri alma' },
      { to: '/moderasyon/odalar', label: 'Odalar', desc: 'Sohbet odaları, üyeler, mesajlar' },
      { to: '/moderasyon/eslesme', label: 'Eşleşme', desc: 'Şikayetli ve yaşı tutarsız profiller' },
      { to: '/moderasyon/kurallar', label: 'Kurallar', desc: 'Kara liste ve otomatik gizleme eşiği' },
      { to: '/moderasyon/ozet', label: 'Özet', desc: 'Şikayet ve karar istatistikleri' },
      { to: '/moderasyon/geri-bildirim', label: 'Geri bildirim', desc: 'Kullanıcılardan gelen hata ve öneriler', soon: true },
    ],
  },
  {
    key: 'users',
    icon: 'group',
    label: 'Kullanıcılar',
    count: ['pendingVerifications', 'pendingSeriesPages'],
    subs: [
      { to: '/kullanicilar', label: 'Kullanıcılar', desc: 'Hesaplar, tikler, roller, durum' },
      {
        to: '/kullanicilar/tikler',
        label: 'Tikler',
        desc: 'Mavi tik başvuruları ve elle verilen tikler',
        admin: true,
        count: 'pendingVerifications',
      },
      {
        to: '/kullanicilar/sayfalar',
        label: 'Dizi sayfaları',
        desc: 'Fan ve resmi sayfa başvuruları',
        admin: true,
        count: 'pendingSeriesPages',
      },
      { to: '/kullanicilar/ekip', label: 'Ekip', desc: 'Moderatörler ve adminler' },
    ],
  },
  {
    key: 'yayin',
    icon: 'campaign',
    label: 'Yayın',
    subs: [
      { to: '/yayin', label: 'Yeni yayın', desc: 'Seçtiğin hesap adına gönderi, anket, oda veya quiz', admin: true },
      { to: '/yayin/quizler', label: 'Quizler', desc: 'Planlı, canlı ve biten quizler; düzenle, başlat, bitir', admin: true },
      { to: '/yayin/bildirim', label: 'Bildirim gönder', desc: 'Push, uygulama içi, e-posta', soon: true, admin: true },
      { to: '/yayin/hesaplar', label: 'Yayın hesapları', desc: 'Panelden adına yayın yapılabilecek hesaplar', admin: true },
    ],
  },
  {
    key: 'katalog',
    icon: 'theaters',
    label: 'Katalog',
    subs: [
      { to: '/katalog', label: 'Yapımlar', desc: 'TMDB önbelleği, sayfa trafiği', soon: true },
      { to: '/katalog/vitrin', label: 'Vitrin', desc: 'Ana sayfa ve keşfet listeleri', soon: true },
    ],
  },
  {
    key: 'ekonomi',
    icon: 'toll',
    label: 'Ekonomi',
    subs: [
      { to: '/ekonomi', label: 'Gelir', desc: 'App Store, Google Play, abonelik', soon: true },
      { to: '/ekonomi/coin', label: 'Coin', desc: 'Dolaşım ve hareketler', soon: true },
      { to: '/ekonomi/sticker', label: "Sticker'lar", desc: 'Basım, nadirlik, stok', soon: true },
      { to: '/ekonomi/pazar', label: 'Pazar', desc: 'İkinci el ilanlar ve satışlar', soon: true },
    ],
  },
  {
    key: 'analiz',
    icon: 'monitoring',
    label: 'Analiz',
    subs: [
      { to: '/analiz', label: 'Özellik kullanımı', desc: 'Hangi özellik ne kadar kullanılıyor', soon: true },
      { to: '/analiz/aktivite', label: 'Aktiviteler', desc: 'Kullanıcı hareketleri, gerçek zamanlı', soon: true },
    ],
  },
  {
    key: 'sistem',
    icon: 'settings',
    label: 'Sistem',
    subs: [
      { to: '/sistem', label: 'Özellik bayrakları', desc: 'Yeniden başlatmadan aç / kapat', admin: true },
      { to: '/sistem/denetim', label: 'Denetim kaydı', desc: 'Kim, ne zaman, ne yaptı', admin: true },
      { to: '/sistem/ayarlar', label: 'Ayarlar', desc: 'Kayıt, bakım modu, eşikler, ödüller', soon: true, admin: true },
      { to: '/sistem/durum', label: 'Durum', desc: 'Servisler, kuyruklar, bakım', soon: true, admin: true },
    ],
  },
];

/** Rolün görebileceği gezinme (admin'e özel alt sayfalar moderatörden düşer). */
export function navFor(isAdmin: boolean): NavGroup[] {
  return NAV.map((g) => ({ ...g, subs: g.subs.filter((s) => isAdmin || !s.admin) })).filter((g) => g.subs.length);
}

export function findSub(path: string): { group: NavGroup; sub: NavSub } | null {
  for (const group of NAV) for (const sub of group.subs) if (sub.to === path) return { group, sub };
  return null;
}
