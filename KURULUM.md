# Paneli çalıştırma ve yayına alma

İki bölüm: **kendi bilgisayarında denemek** ve **sunucuda yayına almak**.

---

## 1. Kendi bilgisayarında dene

### Gerekenler

- **Node.js 22+** → [nodejs.org](https://nodejs.org) (Mac: `brew install node`)
- **Postgres + Redis** — betik ikisini de kendi kurar, iki yoldan biriyle:
  - **Docker Desktop** varsa ve açıksa onu kullanır → [docker.com](https://www.docker.com/products/docker-desktop)
  - yoksa (ya da Docker kapalıysa) **Homebrew** ile Mac'e doğrudan kurar → [brew.sh](https://brew.sh)

  Yani ikisinden *biri* yeterli. Bilgisayarında Postgres/Redis zaten
  çalışıyorsa hiçbiri gerekmez, betik onları kullanır.

Kurulu mu, kontrol et:

```bash
node -v      # v22 veya üstü olmalı → yoksa: brew install node
brew -v      # ya da Docker Desktop açık olsun
```

> Docker kurulu ama Docker Desktop kapalıysa `docker` komutu süresiz
> bekleyebilir. Betik bunu 10 saniyede anlar ve Homebrew yoluna geçer;
> beklemede kalmaz.

### İki depo yan yana dursun

Panel ve backend ayrı depolarda; betik backend'i `../letstalkin-backend`
klasöründe arar.

```bash
cd ~
mkdir -p letstalkin && cd letstalkin

git clone https://github.com/berkeaslans/letstalkin-backend
git clone https://github.com/berkeaslans/letstalkin-admin
```

Sonuç:

```
~/letstalkin/
  letstalkin-backend/
  letstalkin-admin/
```

### Tek komut

```bash
cd ~/letstalkin/letstalkin-admin
npm install
npm run baslat -- --ornek-veri
```

Bu komut sırayla şunları yapar: veritabanı ve Redis'i başlatır → şemayı kurar →
örnek kullanıcı, oda, gönderi ve quiz ekler → backend'i açar → paneli açar.

Bittiğinde **http://localhost:5190** adresine git:

| | |
|---|---|
| Kullanıcı adı | `berke` |
| Şifre | `demo12345` |

İlk kurulumda paket indirme birkaç dakika sürer; sonrakiler saniyeler içinde açılır.

**Sonraki açılışlarda** örnek veriyi tekrar eklemene gerek yok:

```bash
cd ~/letstalkin/letstalkin-admin && npm run baslat
```

### Kendi hesabını admin yapmak

Örnek veri yerine gerçek veriyle çalışıyorsan, hangi kullanıcının panele
girebileceğini sen söylersin:

```bash
ADMIN_USERNAMES=kullaniciadin npm run baslat
```

Bu ad(lar)daki hesaplar açılışta admin olur. Sonrasında panelden
**Kullanıcılar → kişiye tıkla → Yönetim → Rol** ile ekip yönetilir.

Hesap açmak ya da rol vermek için backend deposunda `ekip` betiği de var —
canlıda kullanılan yöntem bu:

```bash
cd ../letstalkin-backend
npm run ekip -- --liste
npm run ekip -- --kullanici ortak --eposta ortak@ornek.com --rol admin
```

### Takılırsan

| Sorun | Çözüm |
|---|---|
| `no such file or directory: letstalkin-admin` | Depoyu henüz klonlamadın. Yukarıdaki `git clone` adımına dön. |
| `letstalkin-backend bulunamadı` | İki depo yan yana değil. Klasör düzenini kontrol et. |
| `Ne Docker ne Homebrew var` | İkisinden birini kur: Docker Desktop ya da `brew.sh`. |
| Docker'da takıldı | Docker Desktop'ı aç (balina simgesi sabitlenene kadar bekle) ya da kapat; kapalıysa betik Homebrew'a geçer. |
| `5190 portu dolu` | Orada çalışan bir şey var. `lsof -ti:5190 \| xargs kill` (Windows: `netstat -ano \| findstr :5190`) |
| `Docker yok` | Docker Desktop'ı kur ve çalıştır. |
| Backend açılmadı | `/tmp/letstalkin-api.log` dosyasına bak. |
| Giriş "yetkin yok" diyor | O hesap admin/moderatör değil. `ADMIN_USERNAMES` ile başlat. |

---

## 2. Sunucuda yayına al

Uygulama sunucuda zaten çalışıyorsa panel onun üstüne ekleniyor: aynı
`docker compose`, aynı ortak Caddy. Backend deposundaki `docs/YAYIN.md` ana
rehberdir; burası panele ait kısım.

### a) Alan adı

Alan adı panelinde A kaydı aç — sertifikayı ortak Caddy kendisi alır:

```
yonetim.letstalkin.com   A   <sunucu-ip>
```

Bunu ilk yap: Caddy'yi sonra yeniden yüklediğinde kayıt yayılmış olur,
sertifika ilk denemede çıkar.

### b) Backend `.env` — iki satır

```bash
# Panel tarayıcıdan API'ye gidiyor; bu köken yoksa giriş çalışmaz.
# Mevcut satıra EKLE, üzerine yazma:
CORS_ORIGINS=https://letstalkin.com,https://yonetim.letstalkin.com

# Panelin derlenirken gömeceği API adresi.
ADMIN_API_URL=https://api.letstalkin.com
```

> `CORS_ORIGINS`'i ezersen web sitesi API'ye erişemez. Satırı açıp sonuna
> virgülle panel adresini ekle.

### c) Veritabanı yedeği

Bu sürüm yeni tablolar ve kolonlar getiriyor (geri bildirim, yönetici notları,
kaydedilmiş görünümler, zamanlanmış duyuru, kara liste sayaçları). Migration'lar
API açılışında kendiliğinden işler, ama önce yedek al:

```bash
cd /srv/letstalkin-backend
docker compose exec -T db pg_dump -U letstalkin letstalkin > ~/yedek-$(date +%F-%H%M).sql
ls -lh ~/yedek-*.sql     # boyutu sıfır olmasın
```

### d) Paneli klonla ve kaldır

Compose, paneli `../letstalkin-admin` klasöründen derler:

```bash
cd /srv                       # backend deposunun bulunduğu klasör
git clone https://github.com/berkeaslans/letstalkin-admin

cd letstalkin-backend
git pull                      # panel uçları master'da
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build api worker admin
```

`api` açılırken migration'ları uygular, `worker` ardından gelir, `admin`
API sağlıklı olunca derlenir. Üçünü birlikte yazmak şart: panelin uçları
yeni API'de, zamanlanmış işler worker'da.

### e) Caddy

Hazır blok `deploy/caddy/letstalkin.caddy` dosyasının sonunda duruyor;
ortak Caddyfile'a ekle:

```caddyfile
yonetim.letstalkin.com {
	encode zstd gzip
	reverse_proxy letstalkin-admin:80
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Robots-Tag "noindex, nofollow"
		Referrer-Policy same-origin
		-Server
	}
}
```

```bash
caddy validate --config /etc/caddy/Caddyfile
caddy reload  --config /etc/caddy/Caddyfile   # diğer siteler kesilmez
```

`validate` hata verirse `reload` yapma — mevcut yapılandırma ayakta kalır.

### f) Panele girecek hesaplar

Hesap varsa yalnız rolü değişir; yoksa oluşturulur ve tek seferlik şifre
ekrana yazılır:

```bash
cd /srv/letstalkin-backend

# Kendini admin yap (uygulamada hesabın zaten var):
docker compose exec api node dist/scripts/ekip.js --kullanici berke --rol admin

# Ortağın için hesap aç:
docker compose exec api node dist/scripts/ekip.js \
  --kullanici ortak --eposta ortak@letstalkin.com --rol admin --isim "Ad Soyad"

# Kimler girebiliyor:
docker compose exec api node dist/scripts/ekip.js --liste

# Yetkiyi geri al:
docker compose exec api node dist/scripts/ekip.js --kullanici eskici --rol user
```

Roller: `admin` her şeyi yapar; `moderator` şikayet, içerik ve kullanıcı
işlemlerini yapar ama ayarlara, ekonomiye ve rol değiştirmeye dokunamaz.
Yeni hesabın şifresi bir daha gösterilmez — ilet ve ilk girişten sonra
değiştirmesini söyle. Sonrası panelden: **Kullanıcılar → kişi → Yönetim → Rol**.

### g) Kontrol

```bash
curl -I https://yonetim.letstalkin.com     # 200 + x-robots-tag: noindex
docker compose ps api worker admin         # üçü de Up
docker compose logs --tail 30 api          # migration hatası olmasın
```

Tarayıcıdan `https://yonetim.letstalkin.com` → kendi hesabınla gir →
**Sistem → Durum**: veritabanı, Redis, kuyruklar ve worker yeşil olmalı.
Worker satırı "hiç worker bağlı değil" diyorsa `docker compose ps worker`
ile bak; zamanlanmış duyurular ve quiz ilerletme ona bağlı.

### h) Güncelleme

```bash
cd /srv/letstalkin-admin && git pull
cd /srv/letstalkin-backend && git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build api worker admin
```

Yalnız panelde değişiklik varsa sondaki listeyi `admin` ile sınırlayabilirsin.

### Ters giderse

| Belirti | Sebep ve çözüm |
|---|---|
| Panel açılıyor, giriş "ağ hatası" | `CORS_ORIGINS`'e panel adresi eklenmemiş. Ekle, `docker compose up -d api`. |
| Giriş oluyor, "yönetim yetkisi yok" | Rol verilmemiş. `ekip.js --kullanici <ad> --rol admin`, 15 saniye içinde geçer. |
| `admin` servisi derlenmiyor | `../letstalkin-admin` klasörü yok ya da eski. Klonla / `git pull`. |
| Sertifika çıkmıyor | DNS henüz yayılmamış. `dig yonetim.letstalkin.com` ile bak, bekle. |
| API migration'da duruyor | `docker compose logs api`. Yedekten dönmek için: `docker compose exec -T db psql -U letstalkin letstalkin < ~/yedek-....sql`. |

## Unutulmaması gerekenler

**Worker şart.** Zamanlanmış duyurular, quiz ilerletme, oda kapatma, bildirim
gönderimi ve bakım işleri `worker` servisinde çalışır. Çalışmıyorsa panelde
**Sistem → Durum** ekranı "hiç worker bağlı değil" der ve kurduğun duyuru
beklemede kalır.

**Panel arama motorlarına kapalı.** `noindex` başlığı hem nginx'te hem Caddy'de
var; ayrıca `index.html` içinde de duruyor.

**Yetki sunucuda denetlenir.** Panel yalnız arayüz; moderatör olmayan biri
adresi bilse de hiçbir veriye ulaşamaz. Her yönetim işlemi silinemez biçimde
denetim kaydına yazılır.

**Google ekranı isteğe bağlı.** Analytics, Search Console ve AdSense bağlanmadan
da panelin geri kalanı tam çalışır; **Analiz → Google** ekranı her biri için
adım adım kurulumu ve gereken ortam değişkenlerini gösterir.
