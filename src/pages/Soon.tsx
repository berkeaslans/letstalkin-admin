import { useLocation } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/misc';

// Backend ucu henüz olmayan bölümler: neyin geleceğini açıkça yazar (sahte veri göstermez).
const PLAN: Record<string, string[]> = {
  '/canli': ['Aktif odalar ve canlı yayınlar, izleyici sayılarıyla', 'Odayı izle, uyarı gönder, oturumu sonlandır', 'Canlı mesaj akışı'],
  '/canli/quiz': [
    'Panelden quiz oluştur: sorular, şıklar, süre, ödül (coin / sticker)',
    'Planla, başlat, iptal et',
    'Canlı skor tablosu ve ödül dağıtımı',
  ],
  '/moderasyon/geri-bildirim': ['Uygulama içi hata ve öneri bildirimleri', 'Yanıtla, çözüldü işaretle'],
  '/katalog': ['TMDB önbelleğindeki yapımlar, sayfa trafiği', 'Önbelleği yenile, yapımı gizle'],
  '/katalog/vitrin': ['Ana sayfa, keşfet ve "ne izlesem" listelerini sırala'],
  '/ekonomi': ['App Store / Google Play satın almaları, iadeler', 'Mavi tik abonelikleri'],
  '/ekonomi/coin': ['Coin dolaşımı ve tüm hareketler', 'Kullanıcı coin düzeltmesi zaten kullanıcı çekmecesinde hazır'],
  '/ekonomi/sticker': ['Yeni sticker basımı: seri, nadirlik, adet, fiyat', 'Stok ve satış takibi'],
  '/ekonomi/pazar': ['İkinci el ilanlar ve satışlar', 'Şüpheli işlem işaretleme, ilanı kaldırma'],
  '/bildirimler': ['Herkese, bir segmente veya tek kişiye push / uygulama içi / e-posta', 'Planlı gönderim, açılma oranı'],
  '/analiz': ['Özellik başına kullanıcı sayısı, elde tutma'],
  '/analiz/aktivite': ['Kayıt, gönderi, oda, satın alma akışı, gerçek zamanlı'],
  '/sistem/ayarlar': [
    'Yeni kayıtları aç / kapat, bakım modu',
    'Asgari uygulama sürümü (zorunlu güncelleme)',
    'Dil ayarları (dile göre içerik filtresi), coin ödülleri, eşikler',
  ],
  '/sistem/durum': ['API, veritabanı, Redis, arama, medya kuyruğu sağlığı', 'Arama indeksini yeniden kur, önbellek temizle'],
};

export function Soon() {
  const { pathname } = useLocation();
  const items = PLAN[pathname] ?? [];
  return (
    <Card>
      <div className="flex flex-col items-start gap-4 px-[18px] py-8 sm:px-8">
        <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-yellow/13 text-yellow">
          <Icon name="schedule" size={24} />
        </span>
        <div>
          <h2 className="text-[18px] font-bold tracking-[-0.3px]">Bu bölüm hazırlanıyor</h2>
          <p className="mt-1 max-w-[56ch] text-[13.5px] text-sub">
            Backend'de bu ekranı besleyecek yönetim uçları açılınca burada çalışacak. Gelecekler:
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          {items.map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-[14px]">
              <Icon name="check_circle" size={18} className="mt-px text-faint" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
