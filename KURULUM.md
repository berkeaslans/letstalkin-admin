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
klasöründe arar. Çalışma **branch'lerde** duruyor, o yüzden `-b` ile klonla:

```bash
cd ~
mkdir -p letstalkin && cd letstalkin

git clone -b claude/admin-uclari https://github.com/berkeaslans/letstalkin-backend
git clone -b claude/admin-panel  https://github.com/berkeaslans/letstalkin-admin
```

Sonuç:

```
~/letstalkin/
  letstalkin-backend/     ← branch: claude/admin-uclari
  letstalkin-admin/       ← branch: claude/admin-panel
```

> Branch'ler main'e birleştirildikten sonra `-b ...` kısmına gerek kalmaz.

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

Panel, backend ile **aynı sunucuda** ve aynı `docker compose` içinde çalışır.
Backend deposundaki `docs/YAYIN.md` ana rehberdir; burası yalnız panele ait kısım.

### a) Alan adı

Panel için bir alt alan adı seç, ör. **yonetim.letstalkin.com**.
Alan adı panelinde A kaydı aç:

```
yonetim.letstalkin.com   A   <sunucu-ip>
```

### b) Backend `.env` — iki satır

Backend deposundaki `.env` dosyasına ekle:

```bash
# Panel tarayıcıdan API'ye gidiyor; bu adrese izin verilmezse giriş çalışmaz.
CORS_ORIGINS=https://yonetim.letstalkin.com

# Panelin derlenirken gömeceği API adresi.
ADMIN_API_URL=https://api.letstalkin.com

# İlk admin(ler) — bu kullanıcı adları açılışta admin olur, sonrası panelden.
ADMIN_USERNAMES=berke
```

> `CORS_ORIGINS` boşsa üretimde **hiçbir** tarayıcı kökenine izin verilmez; panel
> açılır ama giriş yapamaz. Birden çok adres virgülle yazılır.

### c) Caddy

Ortak Caddyfile'a panel bloğunu ekle — hazır hali
`deploy/caddy/letstalkin.caddy` dosyasının sonunda duruyor:

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

### d) Depoyu yanına klonla ve kaldır

Compose, paneli `../letstalkin-admin` klasöründen derler:

```bash
cd /srv            # backend deposunun bulunduğu klasör
git clone https://github.com/berkeaslans/letstalkin-admin

cd letstalkin-backend
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build admin api worker
```

### e) Kontrol

```bash
curl -I https://yonetim.letstalkin.com          # 200 + x-robots-tag: noindex
docker compose ps admin                          # Up
```

Tarayıcıdan `https://yonetim.letstalkin.com` → uygulamadaki admin hesabınla gir.
**Sistem → Durum** ekranında veritabanı, Redis, kuyruklar ve worker yeşil olmalı.

### f) Güncelleme

```bash
cd /srv/letstalkin-admin && git pull
cd ../letstalkin-backend
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build admin
```

---

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
