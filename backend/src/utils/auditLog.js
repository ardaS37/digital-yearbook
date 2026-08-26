const { db } = require('../db');

function writeAuditLog({ actorUserId = null, action, targetType, targetId = null, details = {} }) {
  if (!action || !String(action).trim()) {
    throw new Error('writeAuditLog: action alanı boş bırakılamaz (NOT NULL)');
  }
  db.prepare(
    `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, details_json)
     VALUES (?, ?, ?, ?, ?)`
  ).run(actorUserId, action, targetType, targetId, JSON.stringify(details || {}));
}

module.exports = {
  writeAuditLog
};
