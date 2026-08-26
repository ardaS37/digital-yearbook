const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const NODE_ENV = process.env.NODE_ENV || 'development';
const SESSION_SECRET = process.env.SESSION_SECRET || (NODE_ENV === 'production' ? '' : crypto.randomBytes(32).toString('hex'));

function requireProductionEnv(name, value) {
  if (NODE_ENV === 'production' && !String(value || '').trim()) {
    throw new Error(`${name} environment variable is required in production.`);
  }
  return value;
}

module.exports = {
  ROOT_DIR,
  PORT: Number(process.env.PORT || 3000),
  HOST: process.env.HOST || '127.0.0.1',
  NODE_ENV,
  SESSION_SECRET: requireProductionEnv('SESSION_SECRET', SESSION_SECRET),
  SESSION_DB_DIR: process.env.SESSION_DB_DIR || path.join(ROOT_DIR, 'database'),
  MAINTENANCE_STATE_PATH: process.env.MAINTENANCE_STATE_PATH || path.join(ROOT_DIR, 'database', 'maintenance.json'),
  DB_PATH: process.env.DB_PATH || path.join(ROOT_DIR, 'database', 'yearbook.db'),
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.join(ROOT_DIR, 'uploads', 'photos'),
  GALLERY_UPLOAD_DIR: process.env.GALLERY_UPLOAD_DIR || path.join(ROOT_DIR, 'uploads', 'gallery'),
  CLASS_COVER_UPLOAD_DIR: process.env.CLASS_COVER_UPLOAD_DIR || path.join(ROOT_DIR, 'uploads', 'class-covers'),
  BACKUP_DIR: process.env.BACKUP_DIR || path.join(ROOT_DIR, 'backups'),
  LOG_DIR: process.env.LOG_DIR || path.join(ROOT_DIR, 'logs'),
  SQLITE_BUSY_TIMEOUT_MS: Number(process.env.SQLITE_BUSY_TIMEOUT_MS || 5000),
  SESSION_IDLE_TIMEOUT_MS: Number(process.env.SESSION_IDLE_TIMEOUT_MS || 1000 * 60 * 30),
  SESSION_ABSOLUTE_TIMEOUT_MS: Number(process.env.SESSION_ABSOLUTE_TIMEOUT_MS || 1000 * 60 * 60 * 12),
  MAX_MESSAGE_LENGTH: 2000,
  MAX_SLOGAN_LENGTH: 2000,
  MAX_UPLOAD_SIZE_BYTES: 5 * 1024 * 1024
};
