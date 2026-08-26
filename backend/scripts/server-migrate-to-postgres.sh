#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/yearbook"
BACKUP_ROOT="/var/backups/yearbook"
SCHEMA="public"
SERVICE_NAME=""
PM2_PROCESS=""
SKIP_NPM_INSTALL="0"

usage() {
  cat <<USAGE
Kullanım:
  sudo bash backend/scripts/server-migrate-to-postgres.sh \
    --database-url 'postgres://USER:PASS@HOST:5432/DB' \
    [--app-dir /var/www/yearbook] \
    [--sqlite-db /var/www/yearbook/database/yearbook.db] \
    [--backup-root /var/backups/yearbook] \
    [--schema public] \
    [--service yearbook] \
    [--pm2-process yearbook] \
    [--skip-npm-install]

Notlar:
- Script önce SQLite dosyasının yedeğini alır.
- --service verilirse migration öncesi systemd stop/start yapılır.
- --pm2-process verilirse migration sonrası `pm2 restart <name>` çalışır.
- PostgreSQL migration için backend/scripts/migrate-sqlite-to-postgres.js çağrılır.
USAGE
}

DATABASE_URL_ARG=""
SQLITE_DB=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --database-url)
      DATABASE_URL_ARG="${2:-}"
      shift 2
      ;;
    --app-dir)
      APP_DIR="${2:-}"
      shift 2
      ;;
    --sqlite-db)
      SQLITE_DB="${2:-}"
      shift 2
      ;;
    --backup-root)
      BACKUP_ROOT="${2:-}"
      shift 2
      ;;
    --schema)
      SCHEMA="${2:-}"
      shift 2
      ;;
    --service)
      SERVICE_NAME="${2:-}"
      shift 2
      ;;
    --pm2-process)
      PM2_PROCESS="${2:-}"
      shift 2
      ;;
    --skip-npm-install)
      SKIP_NPM_INSTALL="1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Bilinmeyen argüman: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "${EUID}" -ne 0 ]]; then
  echo "Bu script sudo/root ile çalıştırılmalı." >&2
  exit 1
fi

if [[ -z "${DATABASE_URL_ARG}" ]]; then
  echo "--database-url zorunlu." >&2
  usage
  exit 1
fi

if [[ ! -d "${APP_DIR}" ]]; then
  echo "APP_DIR bulunamadı: ${APP_DIR}" >&2
  exit 1
fi

if [[ -z "${SQLITE_DB}" ]]; then
  SQLITE_DB="${APP_DIR}/database/yearbook.db"
fi

if [[ ! -f "${SQLITE_DB}" ]]; then
  echo "SQLite DB bulunamadı: ${SQLITE_DB}" >&2
  exit 1
fi

if [[ -n "${SERVICE_NAME}" && -n "${PM2_PROCESS}" ]]; then
  echo "Aynı anda hem --service hem --pm2-process kullanmayın." >&2
  exit 1
fi

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/sqlite-to-postgres-${TIMESTAMP}"
mkdir -p "${BACKUP_DIR}"

cleanup() {
  if [[ -n "${SERVICE_NAME}" ]]; then
    systemctl start "${SERVICE_NAME}" || true
  fi
}
trap cleanup EXIT

if [[ -n "${SERVICE_NAME}" ]]; then
  echo "[1/6] Servis durduruluyor: ${SERVICE_NAME}"
  systemctl stop "${SERVICE_NAME}"
fi

echo "[2/6] SQLite dosyaları yedekleniyor: ${BACKUP_DIR}"
cp -a "${SQLITE_DB}" "${BACKUP_DIR}/yearbook.db"
if [[ -f "${SQLITE_DB}-wal" ]]; then
  cp -a "${SQLITE_DB}-wal" "${BACKUP_DIR}/yearbook.db-wal"
fi
if [[ -f "${SQLITE_DB}-shm" ]]; then
  cp -a "${SQLITE_DB}-shm" "${BACKUP_DIR}/yearbook.db-shm"
fi

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "${SQLITE_DB}" ".backup '${BACKUP_DIR}/yearbook-consistent.db'"
fi

if [[ -d "${APP_DIR}/uploads" ]]; then
  tar -czf "${BACKUP_DIR}/uploads.tar.gz" -C "${APP_DIR}" uploads
fi

echo "[3/6] PostgreSQL snapshot (opsiyonel)"
echo "Not: Bu script yerel PostgreSQL sunucusu gerektirmez; --database-url uzak bir PostgreSQL olabilir."
if command -v pg_dump >/dev/null 2>&1; then
  if pg_dump "${DATABASE_URL_ARG}" > "${BACKUP_DIR}/postgres-before-migration.sql" 2>/dev/null; then
    echo "PostgreSQL öncesi dump alındı."
  else
    echo "Uyarı: pg_dump başarısız (boş DB olabilir veya yetki yok). Devam ediliyor." >&2
  fi
else
  echo "Uyarı: pg_dump bulunamadı, PostgreSQL öncesi dump atlandı." >&2
fi

echo "[4/6] Backend bağımlılıkları"
cd "${APP_DIR}/backend"
if [[ "${SKIP_NPM_INSTALL}" != "1" ]]; then
  npm install
else
  echo "npm install atlandı (--skip-npm-install)."
fi

echo "[5/6] SQLite -> PostgreSQL migration"
node scripts/migrate-sqlite-to-postgres.js \
  --sqlite-path "${SQLITE_DB}" \
  --postgres-url "${DATABASE_URL_ARG}" \
  --schema "${SCHEMA}"

echo "[6/6] Tamamlandı. Yedek: ${BACKUP_DIR}"
if [[ -n "${SERVICE_NAME}" ]]; then
  echo "Servis başlatılıyor: ${SERVICE_NAME}"
  systemctl start "${SERVICE_NAME}"
  trap - EXIT
fi

if [[ -n "${PM2_PROCESS}" ]]; then
  if command -v pm2 >/dev/null 2>&1; then
    echo "PM2 process restart: ${PM2_PROCESS}"
    pm2 restart "${PM2_PROCESS}"
  else
    echo "Uyarı: pm2 bulunamadı, restart atlandı." >&2
  fi
fi
