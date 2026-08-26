const { db } = require('../db');

function slugifyIdentifierPart(input) {
  return String(input || '')
    .toLocaleLowerCase('tr')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function buildLoginIdentifier(role, name, userId) {
  const base = slugifyIdentifierPart(name) || 'user';
  return `${role}-${base}-${userId}`;
}

function ensureLoginIdentifier(user) {
  if (user.login_identifier) {
    return user.login_identifier;
  }

  const loginIdentifier = buildLoginIdentifier(user.role, user.name, user.id);
  db.prepare(
    `UPDATE users
     SET login_identifier = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(loginIdentifier, user.id);
  return loginIdentifier;
}

module.exports = {
  buildLoginIdentifier,
  ensureLoginIdentifier
};
