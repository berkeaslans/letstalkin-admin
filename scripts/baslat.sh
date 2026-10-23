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
DB_URL="postgresql://letstalkin:devpassword123@127.0.0.1:5433/letstalkin_dev"
REDIS_URL="redis://127.0.0.1:6379"

pg_up() { (exec 3<>/dev/tcp/127.0.0.1/5433) 2>/dev/null; }
redis_up() { (exec 3<>/dev/tcp/127.0.0.1/6379) 2>/dev/null; }

if ! pg_up || ! redis_up; then
  command -v docker >/dev/null || die "Postgres/Redis çalışmıyor ve Docker da yok.
    Docker Desktop kur (docker.com) ya da Postgres'i 5433, Redis'i 6379 portunda kendin başlat."
  info "Veritabanı ve Redis başlatılıyor (Docker)…"
  docker run -d --name lt-pg -e POSTGRES_USER=letstalkin -e POSTGRES_PASSWORD=devpassword123 \
    -e POSTGRES_DB=letstalkin_dev -e TZ=UTC -e PGTZ=UTC -p 127.0.0.1:5433:5432 \
    -v lt-pgdata:/var/lib/postgresql/data postgres:16 >/dev/null 2>&1 || docker start lt-pg >/dev/null
  docker run -d --name lt-redis -p 127.0.0.1:6379:6379 redis:7 >/dev/null 2>&1 || docker start lt-redis >/dev/null
  for _ in $(seq 1 30); do pg_up && redis_up && break; sleep 1; done
  pg_up || die "Veritabanı açılmadı. 'docker logs lt-pg' ile bak."
fi
ok "Veritabanı ve Redis hazır"

# ---------- 2. Backend ----------
cd "$API_DIR"
[ -d node_modules ] || { info "Backend paketleri kuruluyor (bir kerelik, birkaç dakika)…"; npm install --silent; }

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
  npm run seed:demo --silent || npm run seed:demo
  ok "Örnek kullanıcılar, odalar ve gönderiler eklendi"
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
[ -d node_modules ] || { info "Panel paketleri kuruluyor (bir kerelik)…"; npm install --silent; }

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

# strictPort: port doluysa sessizce başka porta kaymaz, net hata verir.
LT_DEV_BACKEND=http://localhost:3000 npx vite --port 5190 --strictPort || {
  echo
  die "5190 portu dolu. Orada çalışan şeyi kapat ya da şunu dene:
    lsof -ti:5190 | xargs kill      (macOS/Linux)
    netstat -ano | findstr :5190    (Windows — PID'i bulup Görev Yöneticisi'nden kapat)"
}
