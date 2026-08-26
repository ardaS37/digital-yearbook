const { stripHtml } = require('./sanitize');

const DEFAULT_BANNED_WORDS = [
  'amk',
  'aq',
  'orospu',
  'siktir',
  'sikik',
  'piç',
  'pic',
  'yarrak',
  'göt',
  'got'
];

const URL_PATTERN = /(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|io|gg|me|tr)\b)/i;

function normalizeModerationText(value) {
  return stripHtml(value || '').toLocaleLowerCase('tr');
}

function getBannedWords(db) {
  const row = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'moderation_banned_words'")
    .get();
  if (!row || !String(row.setting_value || '').trim()) {
    return DEFAULT_BANNED_WORDS;
  }
  return String(row.setting_value)
    .split(',')
    .map((item) => normalizeModerationText(item).trim())
    .filter(Boolean);
}

function validateContentText(db, value, options = {}) {
  const text = stripHtml(value || '').trim();
  const minLength = Number(options.minLength || 2);
  const blockLinksSetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'moderation_block_links'")
    .get();
  const blockLinks = blockLinksSetting ? blockLinksSetting.setting_value !== '0' : true;
  const allowLinks = Boolean(options.allowLinks) || !blockLinks;

  if (text.length < minLength) {
    return { ok: false, message: `İçerik en az ${minLength} karakter olmalıdır.` };
  }

  if (!allowLinks && URL_PATTERN.test(text)) {
    return { ok: false, message: 'İçerikte link kullanılamaz.' };
  }

  const normalized = normalizeModerationText(text);
  const foundWord = getBannedWords(db).find((word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'iu').test(normalized);
  });

  if (foundWord) {
    return { ok: false, message: 'İçerik yasaklı kelime içerdiği için gönderilemez.' };
  }

  return { ok: true, text };
}

function validateTextFields(db, fields) {
  for (const field of fields) {
    const value = stripHtml(field.value || '').trim();
    if (!value) {
      continue;
    }
    const result = validateContentText(db, value, {
      minLength: field.minLength || 2,
      allowLinks: field.allowLinks
    });
    if (!result.ok) {
      return result;
    }
  }
  return { ok: true };
}

module.exports = {
  validateContentText,
  validateTextFields
};
