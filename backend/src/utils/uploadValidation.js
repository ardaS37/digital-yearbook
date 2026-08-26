const fs = require('fs');

const IMAGE_TYPES = {
  'image/png': {
    extension: '.png',
    matches: (buffer) => buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
  },
  'image/jpeg': {
    extension: '.jpg',
    matches: (buffer) => buffer.subarray(0, 3).toString('hex') === 'ffd8ff'
  },
  'image/webp': {
    extension: '.webp',
    matches: (buffer) => buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  },
  'image/gif': {
    extension: '.gif',
    matches: (buffer) => ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))
  }
};

function isAllowedImageMime(mimetype) {
  return Object.prototype.hasOwnProperty.call(IMAGE_TYPES, String(mimetype || '').toLowerCase());
}

function getSafeImageExtension(mimetype) {
  const imageType = IMAGE_TYPES[String(mimetype || '').toLowerCase()];
  return imageType ? imageType.extension : null;
}

function assertImageSignature(file) {
  if (!file || !file.path) {
    const error = new Error('Görsel dosyası doğrulanamadı.');
    error.code = 'INVALID_IMAGE_SIGNATURE';
    throw error;
  }

  const mimetype = String(file.mimetype || '').toLowerCase();
  const imageType = IMAGE_TYPES[mimetype];
  const buffer = fs.readFileSync(file.path).subarray(0, 16);
  const allowed = Boolean(imageType && imageType.matches(buffer));

  if (!allowed) {
    const error = new Error('Dosya içeriği bildirilen görsel türüyle eşleşmiyor.');
    error.code = 'INVALID_IMAGE_SIGNATURE';
    throw error;
  }
}

module.exports = {
  assertImageSignature,
  getSafeImageExtension,
  isAllowedImageMime
};
