const { db } = require('../db');
const { SESSION_IDLE_TIMEOUT_MS, SESSION_ABSOLUTE_TIMEOUT_MS } = require('../config');

function attachCurrentUser(req, res, next) {
  const now = Date.now();
  req.currentUser = null;
  res.locals.currentUser = null;

  if (req.session) {
    const createdAt = Number(req.session.createdAt || now);
    const lastSeenAt = Number(req.session.lastSeenAt || createdAt);
    const isExpired =
      now - lastSeenAt > SESSION_IDLE_TIMEOUT_MS ||
      now - createdAt > SESSION_ABSOLUTE_TIMEOUT_MS;

    if (isExpired) {
      req.sessionExpired = true;
      req.session.destroy(() => {});
      res.locals.currentUser = null;
      return next();
    }

    if (!req.session.createdAt) {
      req.session.createdAt = createdAt;
    }
    req.session.lastSeenAt = now;
  } else {
    return next();
  }

  const userId = req.session.userId;
  if (!userId) {
    return next();
  }

  const user = db
    .prepare('SELECT id, name, student_number, role, school_id, class_branch, teacher_category, president_class_branch, photo_path, photo_locked, slogan, access_code_hash, status, kvkk_approved_at FROM users WHERE id = ?')
    .get(userId);

  if (!user) {
    req.session.destroy(() => {});
    return next();
  }

  if (user.status === 'inactive') {
    req.sessionInactive = true;
    req.session.destroy(() => {});
    return next();
  }

  req.currentUser = user;
  res.locals.currentUser = user;

  const lastPresenceWriteAt = Number(req.session.lastPresenceWriteAt || 0);
  if (now - lastPresenceWriteAt > 5 * 60 * 1000) {
    db.prepare('UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
    req.session.lastPresenceWriteAt = now;
  }

  return next();
}

function requireLogin(req, res, next) {
  if (!req.currentUser) {
    if (req.sessionInactive) {
      return res.redirect('/logged-out?reason=inactive');
    }
    if (req.sessionExpired) {
      return res.redirect('/logged-out?reason=expired');
    }
    req.flash('error', 'Lütfen önce giriş yapın.');
    return res.redirect('/login');
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.currentUser || req.currentUser.role !== 'admin') {
    req.flash('error', 'Yönetici yetkisi gereklidir.');
    return res.redirect('/');
  }
  return next();
}

function requireAnnouncementPublisher(req, res, next) {
  if (!req.currentUser || !['admin', 'teacher'].includes(req.currentUser.role)) {
    req.flash('error', 'Duyuru yayınlama yetkisi gereklidir.');
    return res.redirect('/');
  }
  return next();
}

module.exports = {
  attachCurrentUser,
  requireLogin,
  requireAdmin,
  requireAnnouncementPublisher
};
