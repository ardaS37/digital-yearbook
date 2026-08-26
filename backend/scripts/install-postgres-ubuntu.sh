#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/yearbook"
DB_NAME="yearbook"
DB_USER="yearbook_user"
DB_PASS=""
DB_HOST="127.0.0.1"
DB_PORT="5432"
WITH_PGBOUNCER="0"

usage() {
  cat <<USAGE
Kullanım:
  sudo bash backend/scripts/install-postgres-ubuntu.sh \
    [--app-dir /var/www/yearbook] \
    [--db-name yearbook] \
    [--db-user yearbook_user] \
    [--db-pass 'guclu-sifre'] \
    [--db-host 127.0.0.1] \
    [--db-port 5432]

Notlar:
- Debian/Ubuntu için PostgreSQL kurar.
- DB ve kullanıcıyı oluşturur (varsa günceller).
- Sonunda DATABASE_URL üretir.
- .env dosyasına DATABASE_URL yazmayı dener.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-dir)
      APP_DIR="${2:-}"; shift 2 ;;
    --db-name)
      DB_NAME="${2:-}"; shift 2 ;;
    --db-user)
      DB_USER="${2:-}"; shift 2 ;;
    --db-pass)
      DB_PASS="${2:-}"; shift 2 ;;
    --db-host)
      DB_HOST="${2:-}"; shift 2 ;;
    --db-port)
      DB_PORT="${2:-}"; shift 2 ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Bilinmeyen argüman: $1" >&2
      usage
      exit 1 ;;
  esac
done

if [[ "${EUID}" -ne 0 ]]; then
  echo "Bu script sudo/root ile çalıştırılmalı." >&2
  exit 1
fi

if [[ -z "${DB_PASS}" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    DB_PASS="$(openssl rand -base64 24 | tr -d '\n' | tr '/+' 'ab' | cut -c1-24)"
  else
    DB_PASS="$(date +%s%N | sha256sum | cut -c1-24)"
  fi
fi

echo "[1/6] Paketler kuruluyor (postgresql, postgresql-contrib, libpq-dev, postgresql-client)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y postgresql postgresql-contrib libpq-dev postgresql-client

echo "[2/6] PostgreSQL servisi başlatılıyor"
systemctl enable postgresql >/dev/null 2>&1 || true
systemctl start postgresql

echo "[3/6] DB ve kullanıcı hazırlanıyor"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO
\$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;
SQL

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO
\$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}') THEN
    CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
  END IF;
END
\$\$;
SQL

sudo -u postgres psql -d "${DB_NAME}" -v ON_ERROR_STOP=1 <<SQL
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
GRANT ALL ON SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
SQL

echo "[4/6] PostgreSQL bağlantı testi"
PGPASSWORD="${DB_PASS}" psql "postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}" -c 'SELECT 1;' >/dev/null

DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

echo "[5/6] APP .env güncelleniyor (varsa)"
BACKEND_ENV="${APP_DIR}/backend/.env"
if [[ -d "${APP_DIR}/backend" ]]; then
  touch "${BACKEND_ENV}"
  if grep -q '^DATABASE_URL=' "${BACKEND_ENV}"; then
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" "${BACKEND_ENV}"
  else
    printf '\nDATABASE_URL=%s\n' "${DATABASE_URL}" >> "${BACKEND_ENV}"
  fi
else
  echo "Uyarı: ${APP_DIR}/backend bulunamadı. .env güncellemesi atlandı." >&2
fi

echo "[6/6] Tamamlandı"
echo "DATABASE_URL='${DATABASE_URL}'"
echo "Sonraki adım:"
echo "  cd ${APP_DIR}"
echo "  sudo bash backend/scripts/server-migrate-to-postgres.sh --database-url '${DATABASE_URL}' --pm2-process yearbook"
