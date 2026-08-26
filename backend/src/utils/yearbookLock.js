const LOCK_KEY = 'yearbook_locked';
const LOCK_MESSAGE_KEY = 'yearbook_lock_message';

function getSetting(db, key, fallback = '') {
  const row = db.prepare('SELECT setting_value FROM app_settings WHERE setting_key = ?').get(key);
  return row ? row.setting_value : fallback;
}

function setSetting(db, key, value) {
  db.prepare(
    `INSERT INTO app_settings (setting_key, setting_value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP`
  ).run(key, String(value || ''));
}

function isYearbookLocked(db) {
  return getSetting(db, LOCK_KEY, '0') === '1';
}

function getYearbookLockState(db) {
  return {
    locked: isYearbookLocked(db),
    message: getSetting(db, LOCK_MESSAGE_KEY, 'Yıllık kilitli. İçerikler yalnızca okunabilir.')
  };
}

function setYearbookLockState(db, locked, message) {
  setSetting(db, LOCK_KEY, locked ? '1' : '0');
  setSetting(db, LOCK_MESSAGE_KEY, message || 'Yıllık kilitli. İçerikler yalnızca okunabilir.');
}

module.exports = {
  getYearbookLockState,
  isYearbookLocked,
  setYearbookLockState
};
