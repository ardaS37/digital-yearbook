/**
 * Uygulama ayarları için merkezi okuma/yazma yardımcıları.
 * app_settings tablosunu doğrudan kullanan her yerden burası import edilmeli.
 */
const { db } = require('../db');

function getSettingValue(key, fallback = '') {
  const row = db.prepare('SELECT setting_value FROM app_settings WHERE setting_key = ?').get(key);
  return row ? row.setting_value : fallback;
}

function setSettingValue(key, value) {
  db.prepare(
    `INSERT INTO app_settings (setting_key, setting_value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(setting_key) DO UPDATE
       SET setting_value = excluded.setting_value,
           updated_at    = CURRENT_TIMESTAMP`
  ).run(key, value == null ? '' : String(value));
}

module.exports = { getSettingValue, setSettingValue };
