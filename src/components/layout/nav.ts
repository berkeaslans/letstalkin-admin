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
  count?: 'openReports' | 'pendingVerifications' | 'pendingSeriesPages' | 'newFeedback';
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
    subs: [
      { to: '/canli', label: 'Şu an', desc: 'Hareketli odalar, canlı yayınlar ve quizler' },
      { to: '/canli/akis', label: 'Canlı akış', desc: 'Uygulamada olan her şey, anında' },
    ],
  },
  {
    key: 'mod',
    icon: 'shield',
    label: 'Moderasyon',
    count: ['openReports', 'newFeedback'],
    subs: [
      { to: '/moderasyon', label: 'Şikayetler', desc: 'Topluluk bildirimleri', count: 'openReports' },
      { to: '/moderasyon/icerik', label: 'İçerik', desc: 'Gönderi ve yorum arama, kaldırma, geri alma' },
      { to: '/moderasyon/odalar', label: 'Odalar', desc: 'Sohbet odaları, üyeler, mesajlar' },
      { to: '/moderasyon/eslesme', label: 'Eşleşme', desc: 'Şikayetli ve yaşı tutarsız profiller' },
      { to: '/moderasyon/kurallar', label: 'Kurallar', desc: 'Kara liste ve otomatik gizleme eşiği' },
      { to: '/moderasyon/ozet', label: 'Özet', desc: 'Şikayet ve karar istatistikleri' },
      {
        to: '/moderasyon/geri-bildirim',
        label: 'Geri bildirim',
        desc: 'Kullanıcılardan gelen hata, öneri ve sorular',
        count: 'newFeedback',
      },
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
      { to: '/yayin/bildirim', label: 'Bildirim gönder', desc: 'Herkese, bir kitleye ya da tek kişiye duyuru', admin: true },
      { to: '/yayin/hesaplar', label: 'Yayın hesapları', desc: 'Panelden adına yayın yapılabilecek hesaplar', admin: true },
    ],
  },
  {
    key: 'katalog',
    icon: 'theaters',
    label: 'Katalog',
    subs: [
      { to: '/katalog', label: 'Yapımlar', desc: 'Uygulamada konuşulan diziler ve filmler' },
      { to: '/katalog/vitrin', label: 'Vitrin', desc: 'Ana sayfada öne çıkan yapımlar ve sırası' },
      { to: '/katalog/etkinlikler', label: 'Etkinlikler', desc: 'Festivaller, ödül törenleri ve film geceleri (Yaklaşanlar)' },
    ],
  },
  {
    key: 'ekonomi',
    icon: 'toll',
    label: 'Ekonomi',
    subs: [
      { to: '/ekonomi', label: 'Gelir', desc: 'Mavi tik abonelikleri ve mağaza', admin: true },
      { to: '/ekonomi/coin', label: 'Coin', desc: 'Dolaşım, kazanç, harcama, tüm hareketler', admin: true },
      { to: '/ekonomi/sticker', label: "Sticker'lar", desc: 'Basım, nadirlik, fiyat, sahipler', admin: true },
      { to: '/ekonomi/pazar', label: 'Pazar', desc: 'İkinci el ilanlar ve satışlar', admin: true },
      { to: '/ekonomi/urunler', label: 'Ürünler', desc: 'Merch ürünleri (Shopier)', admin: true },
    ],
  },
  {
    key: 'analiz',
    icon: 'monitoring',
    label: 'Analiz',
    subs: [
      { to: '/analiz', label: 'Kullanım', desc: 'Hangi özellik ne kadar kullanılıyor' },
      { to: '/analiz/kitle', label: 'Kitle', desc: 'Aktif kullanıcı, platform, dil, elde tutma' },
      { to: '/analiz/google', label: 'Google', desc: 'Analytics, Search Console ve AdSense', admin: true },
    ],
  },
  {
    key: 'sistem',
    icon: 'settings',
    label: 'Sistem',
    subs: [
      { to: '/sistem', label: 'Ayarlar', desc: 'Kayıt, bakım modu, asgari sürüm, ödüller, eşikler', admin: true },
      { to: '/sistem/bayraklar', label: 'Özellik bayrakları', desc: 'Yeniden başlatmadan aç / kapat', admin: true },
      { to: '/sistem/durum', label: 'Durum', desc: 'Servisler, kuyruklar, bakım işleri', admin: true },
      { to: '/sistem/denetim', label: 'Denetim kaydı', desc: 'Kim, ne zaman, ne yaptı', admin: true },
    ],
  },
];

/** Rolün görebileceği gezinme (admin'e özel alt sayfalar moderatörden düşer). */
export function navFor(isAdmin: boolean): NavGroup[] {
  return NAV.map((g) => ({ ...g, subs: g.subs.filter((s) => isAdmin || !s.admin) })).filter((g) => g.subs.length);
}

/** Adresin ait olduğu alt sayfa. Detay sayfaları (ör. /kullanicilar/abc) en uzun
 *  önek eşleşmesiyle üst listesine bağlanır; detail=true döner. */
export function findSub(path: string): { group: NavGroup; sub: NavSub; detail: boolean } | null {
  let best: { group: NavGroup; sub: NavSub } | null = null;
  for (const group of NAV)
    for (const sub of group.subs) {
      if (sub.to === path) return { group, sub, detail: false };
      if (sub.to !== '/' && path.startsWith(`${sub.to}/`) && (!best || sub.to.length > best.sub.to.length)) best = { group, sub };
    }
  return best ? { ...best, detail: true } : null;
}
