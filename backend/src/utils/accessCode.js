const crypto = require('crypto');
const ACCESS_CODE_LENGTH = 12;

function generateAccessCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(ACCESS_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < ACCESS_CODE_LENGTH; i += 1) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

function hashAccessCode(code) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(code, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyAccessCode(code, storedHash) {
  if (!storedHash || !storedHash.includes(':')) {
    return false;
  }

  const [salt, hash] = storedHash.split(':');
  const codeHash = crypto.scryptSync(code, salt, 64).toString('hex');
  const hashBuffer = Buffer.from(hash, 'hex');
  const codeBuffer = Buffer.from(codeHash, 'hex');

  if (hashBuffer.length !== codeBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(hashBuffer, codeBuffer);
}

module.exports = {
  generateAccessCode,
  hashAccessCode,
  verifyAccessCode
};
