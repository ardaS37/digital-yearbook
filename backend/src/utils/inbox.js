const { db } = require('../db');

function createInboxNotification({ userId, actorUserId = null, kind, title, body, linkPath = '' }) {
  if (!Number.isInteger(Number(userId)) || Number(userId) <= 0) {
    return;
  }

  if (actorUserId && Number(actorUserId) === Number(userId)) {
    return;
  }

  db.prepare(
    `INSERT INTO inbox_notifications (user_id, actor_user_id, kind, title, body, link_path)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(Number(userId), actorUserId ? Number(actorUserId) : null, kind, title, body, linkPath);
}

module.exports = {
  createInboxNotification
};
