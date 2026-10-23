# Let's Talkin' — Yönetim paneli

Let's Talkin' ekibinin yönetim paneli: şikayet kuyruğu, kullanıcı ve tik yönetimi,
mavi tik ve dizi sayfası başvuruları, özellik bayrakları, denetim kaydı ve duvar
ekranı (TV). Ayrı bir projedir; yalnız backend'e (`letstalkin-backend`) bağlanır.

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
| Özellik bayrakları, denetim kaydı | | ✓ |

Her yönetim işlemi backend'de `AdminAction` tablosuna yazılır (kim, kime, ne, gerekçe).

## Geliştirme

```bash
npm install
LT_DEV_BACKEND=http://localhost:3000 npm run dev   # http://localhost:5190
```

Geliştirmede `/api` istekleri Vite üzerinden yerel backend'e gider.

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
   (boşsa production'da tarayıcıdan hiçbir köken kabul edilmez).
2. **Panel:** `docker build --build-arg VITE_API_URL=https://api.letstalkin.com -t letstalkin-admin .`
3. **Ters vekil:** alt alan adını konteynerin 80 portuna yönlendir.
4. **İlk admin:** backend'deki `ADMIN_USERNAMES` env'i (virgülle) açılışta bu hesapları admin yapar;
   sonrası panelden yönetilir.

## Oturum

Erişim token'ı yalnız bellekte tutulur; refresh token `localStorage`'da. Refresh her
kullanımda yenilendiği ve aynısı iki kez kullanılırsa backend oturumu düşürdüğü için
yenileme sekmeler arasında Web Locks ile sıralanır.
