const fs = require('fs');
const path = require('path');
const { ROOT_DIR } = require('../config');

function toAbsoluteUploadPath(relativePath) {
  if (!relativePath || typeof relativePath !== 'string' || !relativePath.startsWith('/uploads/')) {
    return null;
  }
  return path.join(ROOT_DIR, relativePath.replace(/^\//, ''));
}

function deleteFileIfExists(relativePath) {
  const absolutePath = toAbsoluteUploadPath(relativePath);
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return;
  }
  fs.unlinkSync(absolutePath);
}

module.exports = {
  deleteFileIfExists
};
