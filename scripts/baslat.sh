#!/usr/bin/env bash
# Paneli tek komutla aç: altyapı (Postgres + Redis) → backend → panel.
# Kullanım:  npm run baslat          (varsa mevcut veriyle)
#            npm run baslat -- --ornek-veri   (demo kullanıcı ve içerik ekler)
#
# İki depo yan yana olmalı:
#   letstalkin-backend/
#   letstalkin-admin/     ← buradasın
set -euo pipefail

PANEL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$(cd "$PANEL_DIR/../letstalkin-backend" 2>/dev/null && pwd || true)"
SEED=0
for arg in "$@"; do [ "$arg" = "--ornek-veri" ] && SEED=1; done

ok()   { printf '\033[32m✓\033[0m %s\n' "$1"; }
info() { printf '\033[36m·\033[0m %s\n' "$1"; }
die()  { printf '\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

[ -n "$API_DIR" ] || die "letstalkin-backend bulunamadı. İki depo yan yana durmalı:
    bir-klasor/
      letstalkin-backend/
      letstalkin-admin/"

command -v node >/dev/null || die "Node.js kurulu değil. nodejs.org'dan 22 veya üstünü kur."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || die "Node.js $NODE_MAJOR çok eski; 22 veya üstü gerekiyor."

# ---------- 1. Altyapı: Postgres + Redis ----------
# İki yol var: Docker (varsayılan) ya da Mac'e doğrudan kurulum (Homebrew).
# Docker yoksa veya yanıt vermiyorsa ikinciye kendiliğinden geçer.
PG_PORT=5433        # Docker yolunda 5433; Homebrew yolunda 5432'ye döner
REDIS_URL="redis://127.0.0.1:6379"

port_open() { (exec 3<>/dev/tcp/127.0.0.1/"$1") 2>/dev/null; }
pg_up()    { port_open "$PG_PORT"; }
redis_up() { port_open 6379; }

# Docker Desktop kapalıyken `docker info` süresiz bekleyebiliyor; 10 sn tanı.
docker_hazir() {
  command -v docker >/dev/null || return 1
  (docker info >/dev/null 2>&1) &
  local pid=$!
  local i=0
  while kill -0 "$pid" 2>/dev/null && [ "$i" -lt 10 ]; do sleep 1; i=$((i + 1)); done
  if kill -0 "$pid" 2>/dev/null; then kill -9 "$pid" 2>/dev/null || true; return 1; fi
  wait "$pid"
}

# Başarısızlıkta die etmez, 1 döner: çağıran Homebrew yoluna geçebilsin.
# (Docker Desktop yarı açık kalabiliyor: sokete yanıt verir ama konteyner
#  başlatamaz. Böyle bir durumda tek seçenek kalmasın.)
altyapi_docker() {
  for img in postgres:16 redis:7; do
    docker image inspect "$img" >/dev/null 2>&1 && continue
    info "Docker görüntüsü indiriliyor: $img (ilk seferde birkaç dakika)"
    docker pull "$img" || return 1
  done

  info "Veritabanı ve Redis başlatılıyor (Docker)…"
  docker start lt-pg >/dev/null 2>&1 || docker run -d --name lt-pg \
    -e POSTGRES_USER=letstalkin -e POSTGRES_PASSWORD=devpassword123 \
    -e POSTGRES_DB=letstalkin_dev -e TZ=UTC -e PGTZ=UTC -p 127.0.0.1:5433:5432 \
    -v lt-pgdata:/var/lib/postgresql/data postgres:16 >/dev/null 2>&1 || return 1
  docker start lt-redis >/dev/null 2>&1 || docker run -d --name lt-redis \
    -p 127.0.0.1:6379:6379 redis:7 >/dev/null 2>&1 || return 1

  for _ in $(seq 1 60); do pg_up && redis_up && break; sleep 1; done
  pg_up && redis_up
}

altyapi_brew() {
  command -v brew >/dev/null || die "Ne Docker ne Homebrew var.
    Şunlardan birini yap:
      1) Docker Desktop kur ve aç  → docker.com/products/docker-desktop
      2) Homebrew kur             → brew.sh  (sonra bu komutu tekrar çalıştır)"

  PG_PORT=5432   # Homebrew Postgres kendi varsayılan portunda çalışır
  local PGBIN
  if ! brew list postgresql@16 >/dev/null 2>&1; then
    info "Postgres kuruluyor (Homebrew, bir kerelik)…"
    brew install postgresql@16 || die "Postgres kurulamadı."
  fi
  PGBIN="$(brew --prefix postgresql@16)/bin"
  export PATH="$PGBIN:$PATH"

  if ! brew list redis >/dev/null 2>&1; then
    info "Redis kuruluyor (Homebrew, bir kerelik)…"
    brew install redis || die "Redis kurulamadı."
  fi

  pg_up    || { info "Postgres başlatılıyor…"; brew services start postgresql@16 >/dev/null; }
  redis_up || { info "Redis başlatılıyor…";    brew services start redis >/dev/null; }

  for _ in $(seq 1 60); do pg_up && redis_up && break; sleep 1; done
  pg_up    || die "Postgres açılmadı. 'brew services list' ile bak."
  redis_up || die "Redis açılmadı. 'brew services list' ile bak."

  # Uygulamanın beklediği rol ve veritabanı (yeni kurulumda yoklar).
  psql -p "$PG_PORT" -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='letstalkin'" 2>/dev/null | grep -q 1 \
    || createuser -p "$PG_PORT" -s letstalkin 2>/dev/null || true
  psql -p "$PG_PORT" -d postgres -c "ALTER ROLE letstalkin WITH LOGIN PASSWORD 'devpassword123'" >/dev/null 2>&1 || true
  psql -p "$PG_PORT" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='letstalkin_dev'" 2>/dev/null | grep -q 1 \
    || createdb -p "$PG_PORT" -O letstalkin letstalkin_dev 2>/dev/null || true
}

if ! pg_up || ! redis_up; then
  if docker_hazir; then
    altyapi_docker || {
      info "Docker ile başlatılamadı (Docker Desktop yarı açık olabilir) — Homebrew yoluna geçiliyor."
      altyapi_brew
    }
  else
    [ -n "$(command -v docker || true)" ] &&
      info "Docker yanıt vermiyor (Docker Desktop kapalı olabilir) — Homebrew yoluna geçiliyor."
    altyapi_brew
  fi
fi
DB_URL="postgresql://letstalkin:devpassword123@127.0.0.1:${PG_PORT}/letstalkin_dev"
ok "Veritabanı ve Redis hazır (port ${PG_PORT})"

# ---------- 2. Backend ----------
# 3000 portunda eski bir backend varsa sağlık kontrolü onu "hazır" sanar;
# tohum veri bir veritabanına, sorgular başkasına gider. Baştan durdur.
if port_open 3000; then
  die "3000 portu dolu — orada eski bir backend çalışıyor.
    Onu kapatmadan devam edilemez, yoksa panel yanlış veritabanına bağlanır:
      lsof -ti:3000 | xargs kill      (macOS/Linux)
      netstat -ano | findstr :3000    (Windows)
    Sonra bu komutu tekrar çalıştır."
fi

cd "$API_DIR"
[ -d node_modules ] || { info "Backend paketleri kuruluyor (bir kerelik, birkaç dakika)…"; npm install --no-audit --no-fund; }

export DATABASE_URL="$DB_URL"
export REDIS_URL="$REDIS_URL"
export NODE_ENV=development
export JWT_ACCESS_SECRET="gelistirme-access-anahtari-0123456789"
export JWT_REFRESH_SECRET="gelistirme-refresh-anahtari-0123456789"
export INTERNAL_API_TOKEN="gelistirme-ic-token-0123456789"
# Panel tarayıcıdan geldiği için köken izni şart.
export CORS_ORIGINS="http://localhost:5190"
# Bu kullanıcı adları açılışta admin olur (panel girişi için).
export ADMIN_USERNAMES="${ADMIN_USERNAMES:-berke}"

npx prisma generate --silent >/dev/null 2>&1 || npx prisma generate >/dev/null
npx prisma migrate deploy >/dev/null
ok "Veritabanı şeması güncel"

if [ "$SEED" = 1 ]; then
  info "Örnek veri ekleniyor…"
  if npm run seed:demo; then
    ok "Örnek kullanıcılar, odalar ve gönderiler eklendi"
  else
    die "Örnek veri eklenemedi. En olası sebep: bu veritabanında zaten var.
    Varsa örnek veriyi tekrar eklemeye gerek yok, parametresiz başlat:
      npm run baslat
    Sıfırdan kurmak istersen veritabanını boşalt:
      docker rm -f lt-pg && docker volume rm lt-pgdata     (Docker yolu)
      dropdb -p ${PG_PORT} letstalkin_dev                  (Homebrew yolu)"
  fi
fi

info "Backend açılıyor (http://localhost:3000)…"
npx tsx src/index.ts > /tmp/letstalkin-api.log 2>&1 &
API_PID=$!
# Çıkışta arkada süreç bırakma.
trap 'kill $API_PID 2>/dev/null || true' EXIT INT TERM

for _ in $(seq 1 40); do
  if curl -fsS http://localhost:3000/health >/dev/null 2>&1; then break; fi
  kill -0 $API_PID 2>/dev/null || { tail -20 /tmp/letstalkin-api.log; die "Backend açılamadı (günlük yukarıda)."; }
  sleep 1
done
curl -fsS http://localhost:3000/health >/dev/null 2>&1 || { tail -20 /tmp/letstalkin-api.log; die "Backend yanıt vermedi."; }
ok "Backend hazır · günlük: /tmp/letstalkin-api.log"

# ---------- 3. Panel ----------
cd "$PANEL_DIR"
[ -d node_modules ] || { info "Panel paketleri kuruluyor (bir kerelik)…"; npm install --no-audit --no-fund; }

cat <<MESAJ

  Panel açılıyor:  http://localhost:5190
  Giriş:           uygulamadaki hesabınla (rolü admin ya da moderatör olmalı)
MESAJ
if [ "$SEED" = 1 ]; then
  cat <<MESAJ
  Örnek hesap:     kullanıcı adı "berke" · şifre "demo12345"  (admin yapıldı)
MESAJ
else
  cat <<MESAJ
  Admin yapmak:    ADMIN_USERNAMES=kullaniciadin npm run baslat
MESAJ
fi
echo "  Durdurmak için: Ctrl+C"
echo

# Portu önce biz kontrol edelim: Ctrl+C ile kapatınca "port dolu" demesin.
if (exec 3<>/dev/tcp/127.0.0.1/5190) 2>/dev/null; then
  die "5190 portu dolu. Orada çalışan şeyi kapat ya da şunu dene:
    lsof -ti:5190 | xargs kill      (macOS/Linux)
    netstat -ano | findstr :5190    (Windows — PID'i bulup Görev Yöneticisi'nden kapat)"
fi

# strictPort: yine de doluysa sessizce başka porta kaymasın.
# exec KULLANMA: kabuk ayakta kalsın ki çıkış tuzağı backend'i kapatabilsin.
LT_DEV_BACKEND=http://localhost:3000 npx vite --port 5190 --strictPort
