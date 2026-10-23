# Let's Talkin' — Yönetim paneli

Let's Talkin' ekibinin yönetim paneli. Web ve mobil uygulama aynı backend'i
kullandığı için ikisi de buradan yönetilir. Ayrı bir projedir; yalnız backend'e
(`letstalkin-backend`) bağlanır.

| Bölüm | Neler var |
|---|---|
| Genel bakış | Bugünün sayıları, gündem (bekleyen işler), canlı akış, TV duvar ekranı |
| Canlı | Hareketli odalar, canlı yayınlar (sonlandır), canlı quizler; anlık olay akışı |
| Moderasyon | Şikayetler (toplu karar, şikayetçi ve yazar sicili), içerik ara/kaldır/geri al, odalar, eşleşme, kara liste (kural başına yakalama sayısı), özet, geri bildirim kutusu |
| Kullanıcılar | Liste (sıralama, CSV), kullanıcı sayfası (tik, rol, ban, coin, profil, hesap, oturumlar, içerik, bağlantılar, ekip notları, geçmiş), mavi tik ve dizi sayfası başvuruları, ekip |
| Yayın | Seçilen hesap adına gönderi/anket/oda/quiz, quiz yönetimi, toplu bildirim, yayın hesapları |
| Katalog | Yapımlar ve yapım karnesi, ana sayfa vitrini |
| Ekonomi | Abonelik geliri, coin, sticker basımı, pazar, merch ürünleri |
| Analiz | Özellik kullanımı, kitle (DAU/WAU/MAU, platform, elde tutma), Google (GA4, Search Console, AdSense) |
| Sistem | Ayarlar (kayıt, bakım modu, asgari sürüm, ödüller, eşikler), özellik bayrakları, servis durumu ve kuyruklar, denetim kaydı (yönetici, metin ve tarih filtresi, CSV) |

Her ayrıntı (kullanıcı, oda, quiz, sticker, yapım) kendi adresinde açılır; bağlantı
paylaşılabilir, geri tuşu çalışır.

**Klavye:** `⌘K` (Windows'ta `Ctrl+K`) komut paletini açar — tek kutudan kullanıcı,
oda, quiz, yapım, sticker ve ürün aranır (kimlik yapıştırmak da çalışır), sayfalara
ve sık yapılan işlere gidilir. `g` sonra bir harf bölüme atlar (`g m` şikayetler,
`g u` kullanıcılar…). Şikayet kuyruğunda `j`/`k` gezer, `x` seçer, `e` yoksayar,
`h` içeriği kaldırır. Tam liste `?` ile açılır.

**Gerçek zamanlı:** panel backend'in Socket.IO `admin` kanalına bağlanır (yalnız
ekip katılabilir). Kayıt, gönderi, şikayet, oda, quiz, satış, başvuru ve geri
bildirimler anında düşer; ilgili ekranlar kendini tazeler, şikayet ve başvurularda
ses çalar. Bağlantı koparsa ekranlar 15 sn'de bir yoklamaya döner (üst barda gösterge).

## Yetki

Yetki sunucuda denetlenir; panel yalnız arayüzdür. Giriş, uygulamadaki Let's Talkin'
hesabıyla yapılır ve yalnız `moderator` / `admin` rolleri içeri girer.

| | Moderatör | Admin |
|---|:-:|:-:|
| Şikayet kararı, ban | ✓ | ✓ |
| Kullanıcı listesi ve detayı (e-posta hariç) | ✓ | ✓ |
| E-posta görme / e-postayla arama | | ✓ |
| Tik verme, rol değiştirme, coin düzeltme | | ✓ |
| Mavi tik ve dizi sayfası kararları | | ✓ |
| İçerik, oda, eşleşme moderasyonu; geri bildirim yanıtlama | ✓ | ✓ |
| Canlı ekran, analiz (kullanım, kitle), katalog | ✓ | ✓ |
| Hesap adına yayın, quiz yönetimi, toplu bildirim | | ✓ |
| Ekonomi (coin, sticker, pazar, ürün, gelir), vitrin | | ✓ |
| Sistem ayarları, bakım modu, bayraklar, kuyruklar, denetim kaydı, Google | | ✓ |

Her yönetim işlemi backend'de `AdminAction` tablosuna yazılır (kim, kime, ne, gerekçe);
kayıtlar panelden silinemez. Bir hesap hakkında tutulan **ekip notları** yalnız panelde
görünür, kullanıcıya hiçbir yerde gösterilmez.

## Geliştirme

```bash
npm install
LT_DEV_BACKEND=http://localhost:3000 npm run dev   # http://localhost:5190
```

Geliştirmede `/api` istekleri ve `/socket.io` (WebSocket) Vite üzerinden yerel backend'e gider.

| Komut | |
|---|---|
| `npm run typecheck` | Tip kontrolü |
| `npm run lint` | Biome |
| `npm run build` | Üretim derlemesi (`dist/`) |
| `npm run api:types` | `contracts/openapi.json` → `src/lib/api/schema.gen.ts` |
| `npm run icons` | `icon-names.ts` listesinden ikon fontu alt kümesi (internet gerekir) |

**Sözleşme:** backend'de uç değişince `letstalkin-backend/openapi.json`'ı
`contracts/`'a kopyala ve `npm run api:types` çalıştır.

## Yayına alma

1. **Backend:** `CORS_ORIGINS` env'ine panelin adresini ekle, ör. `https://yonetim.letstalkin.com`
   (boşsa production'da tarayıcıdan hiçbir köken kabul edilmez). Aynı ayar gerçek zamanlı
   bağlantıyı (Socket.IO) da kapsar; API önündeki vekil WebSocket'i (`/socket.io/`) geçirmeli.
   Google ekranı için backend'e `GOOGLE_SERVICE_ACCOUNT_JSON`, `GA4_PROPERTY_ID`,
   `SEARCH_CONSOLE_SITE`, `ADSENSE_*` eklenir (adımlar panelde ve backend `.env.example`'da).
2. **Panel:** `docker build --build-arg VITE_API_URL=https://api.letstalkin.com -t letstalkin-admin .`
3. **Ters vekil:** alt alan adını konteynerin 80 portuna yönlendir.
4. **İlk admin:** backend'deki `ADMIN_USERNAMES` env'i (virgülle) açılışta bu hesapları admin yapar;
   sonrası panelden yönetilir.

## Oturum

Erişim token'ı yalnız bellekte tutulur; refresh token `localStorage`'da. Refresh her
kullanımda yenilendiği ve aynısı iki kez kullanılırsa backend oturumu düşürdüğü için
yenileme sekmeler arasında Web Locks ile sıralanır.
