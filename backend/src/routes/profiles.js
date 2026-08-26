const fs = require('fs');
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { db } = require('../db');
const { MAX_MESSAGE_LENGTH, MAX_SLOGAN_LENGTH, UPLOAD_DIR, MAX_UPLOAD_SIZE_BYTES } = require('../config');
const { requireLogin } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');
const { stripHtml } = require('../utils/sanitize');
const { deleteFileIfExists } = require('../utils/files');
const { assertImageSignature, getSafeImageExtension, isAllowedImageMime } = require('../utils/uploadValidation');
const { writeAuditLog } = require('../utils/auditLog');
const { isFeatureEnabled } = require('../utils/features');
const { buildThemeAccentPair, isReadableThemeColor, normalizeThemeColor } = require('../utils/colors');
const { createInboxNotification } = require('../utils/inbox');
const { verifyAccessCode } = require('../utils/accessCode');
const { createApprovalRequest, isContentApprovalEnabled } = require('../utils/contentApproval');
const { validateContentText, validateTextFields } = require('../utils/contentModeration');
const { calculateProfileCompletion } = require('../utils/profileCompletion');
const { compressImage } = require('../utils/imageCompress');

const router = express.Router();

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = getSafeImageExtension(file.mimetype);
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
  }
});

const photoUpload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
  fileFilter: (_, file, cb) => {
    if (!isAllowedImageMime(file.mimetype)) {
      return cb(new Error('Yalnızca görsel dosyaları yüklenebilir.'));
    }
    return cb(null, true);
  }
});

const messageLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Çok fazla mesaj işlemi yapıldı. Lütfen daha sonra tekrar deneyin.'
});

const MAX_PROFILE_BIO_LENGTH = 1500;
const MAX_PROFILE_FREE_TEXT_LENGTH = 4000;
const MAX_PROFILE_MEMORY_LENGTH = 500;
const MAX_PROFILE_QUOTE_LENGTH = 300;
const MAX_THREE_WORDS_LENGTH = 80;
const MAX_GUESTBOOK_LENGTH = 500;
const MAX_MANAGER_INBOX_MESSAGE_LENGTH = 1000;
const BIRTH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const CONTACT_FIELDS = [
  'contact_phone',
  'contact_email',
  'contact_instagram',
  'contact_x',
  'contact_facebook',
  'contact_linkedin',
  'contact_nsocial'
];
const MAX_CUSTOM_CONTACTS = 12;
const MAX_CUSTOM_CONTACT_LABEL_LENGTH = 40;
const MAX_CUSTOM_CONTACT_VALUE_LENGTH = 160;

CONTACT_FIELDS.forEach((field) => {
  try {
    db.exec(`ALTER TABLE users ADD COLUMN ${field} TEXT DEFAULT ''`);
  } catch (error) {
    if (!String(error.message || '').match(/duplicate column|already exists/i)) {
      throw error;
    }
  }
});
try {
  db.exec("ALTER TABLE users ADD COLUMN free_text TEXT DEFAULT ''");
} catch (error) {
  if (!String(error.message || '').match(/duplicate column|already exists/i)) {
    throw error;
  }
}
try {
  db.exec("ALTER TABLE users ADD COLUMN custom_contacts_json TEXT DEFAULT '[]'");
} catch (error) {
  if (!String(error.message || '').match(/duplicate column|already exists/i)) {
    throw error;
  }
}
try {
  db.exec('ALTER TABLE users ADD COLUMN profile_cover_locked INTEGER NOT NULL DEFAULT 0 CHECK (profile_cover_locked IN (0, 1));');
} catch (error) {
  if (!String(error.message || '').match(/duplicate column|already exists/i)) {
    throw error;
  }
}
db.exec(`
  CREATE TABLE IF NOT EXISTS profile_likes (
    profile_user_id INTEGER NOT NULL,
    liker_user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (profile_user_id, liker_user_id),
    FOREIGN KEY (profile_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (liker_user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_profile_likes_profile_user_id ON profile_likes(profile_user_id, created_at)');

function isAdminProfile(user) {
  return Boolean(user && user.role === 'admin');
}

function canDeleteGuestbookEntry(currentUser, profileId, entry) {
  const currentUserId = Number(currentUser && currentUser.id);
  return Boolean(
    currentUser &&
      (currentUser.role === 'admin' || currentUserId === Number(profileId) || currentUserId === Number(entry.author_user_id))
  );
}

function isSchoolManager(user) {
  return Boolean(
    user &&
      (user.role === 'admin' ||
        (user.role === 'teacher' && ['principal', 'vice_principal', 'head_vice_principal'].includes(user.teacher_category || '')))
  );
}

function censorName(name) {
  if (!name) return '';
  return String(name).split(' ').map((word) => {
    if (word.length <= 2) return word + '*';
    return word.slice(0, 2) + '*'.repeat(word.length - 2);
  }).join(' ');
}

function requireFeature(req, res, key, redirectTo = '/', message = 'Bu özellik şu anda kapalı.') {
  if (isFeatureEnabled(req.featureFlags || {}, key)) {
    return true;
  }
  req.flash('error', message);
  res.redirect(redirectTo);
  return false;
}

function parseCustomContacts(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function normalizeCustomContacts(value) {
  return parseCustomContacts(value)
    .map((item) => ({
      label: stripHtml(item && item.label ? item.label : '').slice(0, MAX_CUSTOM_CONTACT_LABEL_LENGTH),
      value: stripHtml(item && item.value ? item.value : '').slice(0, MAX_CUSTOM_CONTACT_VALUE_LENGTH),
      href: stripHtml(item && item.href ? item.href : '').slice(0, MAX_CUSTOM_CONTACT_VALUE_LENGTH)
    }))
    .filter((item) => item.label && item.value)
    .slice(0, MAX_CUSTOM_CONTACTS);
}

function getCustomContactHref(item) {
  const rawHref = String(item.href || '').trim();
  const rawValue = String(item.value || '').trim();
  if (/^https?:\/\//i.test(rawHref)) return rawHref;
  if (/^mailto:/i.test(rawHref) || /^tel:/i.test(rawHref)) return rawHref;
  if (/^https?:\/\//i.test(rawValue)) return rawValue;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawValue)) return `mailto:${rawValue}`;
  if (/^\+?[0-9][0-9\s().-]{5,}$/.test(rawValue)) return `tel:${rawValue.replace(/\s/g, '')}`;
  return '';
}

function isTeacherMessageBlocked(featureFlags, targetUser) {
  return Boolean(targetUser && targetUser.role === 'teacher' && !isFeatureEnabled(featureFlags || {}, 'teacher_yearbook_messages'));
}

function isTeacherThreeWordsBlocked(featureFlags, targetUser) {
  return Boolean(targetUser && targetUser.role === 'teacher' && !isFeatureEnabled(featureFlags || {}, 'teacher_three_words'));
}

function ensurePhotoUploadAllowed(req, res, next) {
  if (req.currentUser.role === 'guest') {
    req.flash('error', 'Misafir profili yalnızca görüntüleme yapabilir.');
    return res.redirect(`/profiles/${req.currentUser.id}`);
  }

  if (req.profilePhotoEditMode === 'admin_only') {
    req.flash('error', 'Profil fotoğrafı ve kapak görseli yalnızca yönetici tarafından güncellenebilir.');
    return res.redirect(`/profiles/${req.currentUser.id}`);
  }

  const current = db.prepare('SELECT photo_locked FROM users WHERE id = ?').get(req.currentUser.id);
  if (current && (current.photo_locked === true || Number(current.photo_locked) === 1)) {
    req.flash('error', 'Profil fotoğrafınız yönetici tarafından kilitlendiği için değiştirilemez.');
    return res.redirect(`/profiles/${req.currentUser.id}`);
  }

  return next();
}

function ensureCoverUploadAllowed(req, res, next) {
  if (req.currentUser.role === 'guest') {
    req.flash('error', 'Misafir profili yalnızca görüntüleme yapabilir.');
    return res.redirect(`/profiles/${req.currentUser.id}`);
  }

  if (req.profilePhotoEditMode === 'admin_only') {
    req.flash('error', 'Profil fotoğrafı ve kapak görseli yalnızca yönetici tarafından güncellenebilir.');
    return res.redirect(`/profiles/${req.currentUser.id}`);
  }

  const current = db.prepare('SELECT profile_cover_locked FROM users WHERE id = ?').get(req.currentUser.id);
  if (current && (current.profile_cover_locked === true || Number(current.profile_cover_locked) === 1)) {
    req.flash('error', 'Profil kapağınız yönetici tarafından kilitlendiği için değiştirilemez.');
    return res.redirect(`/profiles/${req.currentUser.id}`);
  }

  return next();
}

function requireLiveOwnProfile(req, res, next) {
  if (req.currentUser && req.currentUser.status === 'archived') {
    req.flash('error', 'Arşiv yıllıkları salt okunur. Bu profilde düzenleme yapılamaz.');
    return res.redirect(`/profiles/${req.currentUser.id}`);
  }
  return next();
}

router.use('/profiles/me', requireLogin, (req, res, next) => {
  if (req.method === 'GET') return next();
  return requireLiveOwnProfile(req, res, next);
});

router.use('/profiles/:id', requireLogin, (req, res, next) => {
  if (req.method === 'GET') return next();
  const profileId = Number(req.params.id || 0);
  if (!Number.isInteger(profileId) || profileId <= 0) return next();
  const row = db.prepare('SELECT id, status FROM users WHERE id = ?').get(profileId);
  if (row && row.status === 'archived') {
    req.flash('error', 'Arşiv yıllıkları salt okunur. Bu profilde işlem yapılamaz.');
    return res.redirect(`/profiles/${profileId}`);
  }
  return next();
});

router.get('/profiles/:id', requireLogin, (req, res) => {
  const profileId = Number(req.params.id);
  const currentUserId = Number(req.currentUser.id);
  if (!Number.isInteger(profileId) || profileId <= 0) {
    req.flash('error', 'Geçersiz profil numarası.');
    return res.redirect('/');
  }

  const profile = db
    .prepare(
      `SELECT id, name, student_number, role, class_branch, photo_path, profile_cover_path, photo_locked, profile_cover_locked,
              profile_theme_color, slogan, bio, free_text, favorite_memory, favorite_quote, birth_date, featured_message_id,
              contact_phone, contact_email, contact_instagram, contact_x, contact_facebook, contact_linkedin, contact_nsocial,
              custom_contacts_json, yearbook_opt_out,
              last_active_at, profile_visit_count, status, created_at, updated_at
       FROM users
       WHERE id = ?`
    )
    .get(profileId);

  if (!profile) {
    req.flash('error', 'Profil bulunamadı.');
    return res.redirect('/');
  }
  if (isAdminProfile(profile)) {
    req.flash('error', 'Yonetici profilleri kapali.');
    return res.redirect(req.currentUser.role === 'admin' ? '/admin' : '/');
  }
  const isOwnProfile = currentUserId === profileId;

  const userReport = !isOwnProfile
    ? db
        .prepare(
          `SELECT id, status
           FROM user_reports
           WHERE reported_user_id = ? AND reporter_user_id = ?`
        )
        .get(profileId, req.currentUser.id)
    : null;

  if (!isOwnProfile) {
    const visitInsert = db.prepare(
      `INSERT OR IGNORE INTO profile_unique_visits (profile_user_id, visitor_user_id)
       VALUES (?, ?)`
    ).run(profileId, req.currentUser.id);
    if (visitInsert.changes > 0) {
      db.prepare('UPDATE users SET profile_visit_count = profile_visit_count + 1 WHERE id = ?').run(profileId);
      profile.profile_visit_count += 1;
    }
  }

  const messages = db
    .prepare(
      `SELECT m.id, m.message, m.created_at, m.updated_at, m.is_export_priority,
              sender.id as sender_id, sender.name as sender_name, sender.photo_path as sender_photo_path,
              EXISTS(
                SELECT 1
                FROM message_flags mf
                WHERE mf.message_id = m.id AND mf.reporter_user_id = ?
              ) AS flagged_by_current_user
       FROM messages m
       JOIN users sender ON sender.id = m.from_user_id
       WHERE m.to_user_id = ?
       ORDER BY m.is_export_priority DESC, m.created_at DESC`
    )
    .all(req.currentUser.id, profileId);

  const featuredMessage = profile.featured_message_id
    ? db
        .prepare(
          `SELECT m.id, m.message, m.created_at, m.updated_at,
                  sender.id AS sender_id, sender.name AS sender_name, sender.photo_path AS sender_photo_path
           FROM messages m
           JOIN users sender ON sender.id = m.from_user_id
           WHERE m.id = ? AND m.to_user_id = ?`
        )
        .get(profile.featured_message_id, profileId)
    : null;

  const guestbookEntries = db
    .prepare(
      `SELECT g.id, g.body, g.created_at, g.updated_at, g.author_user_id,
              author.name AS author_name, author.photo_path AS author_photo_path
       FROM profile_guestbook_entries g
       JOIN users author ON author.id = g.author_user_id
       WHERE g.profile_user_id = ?
       ORDER BY g.created_at DESC
       LIMIT 30`
    )
    .all(profileId);
  const inboxNotifications = isOwnProfile
    && isFeatureEnabled(req.featureFlags, 'profile_inbox')
    ? db
        .prepare(
          `SELECT n.id, n.kind, n.title, n.body, n.link_path, n.created_at, actor.name AS actor_name
           FROM inbox_notifications n
           LEFT JOIN users actor ON actor.id = n.actor_user_id
           WHERE n.user_id = ?
           ORDER BY n.created_at DESC
           LIMIT 30`
        )
        .all(profileId)
    : [];

  const existingMessage = db
    .prepare('SELECT id, message, created_at, updated_at FROM messages WHERE from_user_id = ? AND to_user_id = ?')
    .get(req.currentUser.id, profileId);
  const messageApproval = db
    .prepare(
      `SELECT id, item_type, status, created_at, reviewed_at
       FROM content_approval_requests
       WHERE actor_user_id = ? AND target_user_id = ? AND item_type IN ('profile_message', 'profile_message_edit')
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(req.currentUser.id, profileId);
  const pendingMessage = messageApproval && messageApproval.status === 'pending' ? messageApproval : null;
  const draftMessage = db
    .prepare('SELECT id, draft_text, updated_at FROM message_drafts WHERE from_user_id = ? AND to_user_id = ?')
    .get(req.currentUser.id, profileId);
  const threeWords = db
    .prepare(
      `SELECT t.id, t.words, t.updated_at, author.id AS author_id, author.name AS author_name
       FROM profile_three_words t
       JOIN users author ON author.id = t.author_user_id
       WHERE t.profile_user_id = ?
       ORDER BY t.updated_at DESC
       LIMIT 20`
    )
    .all(profileId);
  const myThreeWords = db
    .prepare('SELECT id, words FROM profile_three_words WHERE profile_user_id = ? AND author_user_id = ?')
    .get(profileId, req.currentUser.id);
  const profileLikeCount = db
    .prepare('SELECT COUNT(*) AS total FROM profile_likes WHERE profile_user_id = ?')
    .get(profileId).total;
  const likedByCurrentUser = db
    .prepare('SELECT 1 FROM profile_likes WHERE profile_user_id = ? AND liker_user_id = ?')
    .get(profileId, req.currentUser.id);
  const isGuestReadonly = req.currentUser.role === 'guest';
  const isTeacherToTeacher = req.currentUser.role === 'teacher' && profile.role === 'teacher';
  const isTeacherMessageDisabled = isTeacherMessageBlocked(req.featureFlags, profile);
  const isOptedOut = Boolean(profile.yearbook_opt_out);
  const canSeeRealName = isOwnProfile || req.currentUser.role === 'admin';
  const displayName = isOptedOut && !canSeeRealName ? censorName(profile.name) : profile.name;
  const isTeacherThreeWordsDisabled = isTeacherThreeWordsBlocked(req.featureFlags, profile);
  const normalizedProfileThemeColor = normalizeThemeColor(profile.profile_theme_color || '');
  const themePair = buildThemeAccentPair(normalizedProfileThemeColor || '');
  const customContactItems = normalizeCustomContacts(profile.custom_contacts_json).map((item) => ({
    ...item,
    href: getCustomContactHref(item)
  }));
  const profileCompletion = calculateProfileCompletion(profile);

  return res.render('profile', {
    title: `${profile.name} Profili`,
    profile,
    messages,
    isOwnProfile,
    canEditOwnProfile: isOwnProfile && !isGuestReadonly && profile.status !== 'archived',
    canSendManagerInboxMessage: !isOwnProfile && isSchoolManager(req.currentUser) && isFeatureEnabled(req.featureFlags, 'profile_inbox'),
    canWriteMessage: !isOwnProfile && !isGuestReadonly && !isTeacherToTeacher && !isTeacherMessageDisabled && !existingMessage && !pendingMessage && !isOptedOut,
    messageAlreadySent: Boolean(existingMessage),
    featuredMessage: isFeatureEnabled(req.featureFlags, 'profile_featured_message') ? featuredMessage : null,
    existingMessage,
    pendingMessage,
    messageApproval,
    draftMessage,
    threeWords,
    myThreeWords,
    profileLikeCount: Number(profileLikeCount || 0),
    likedByCurrentUser: Boolean(likedByCurrentUser),
    guestbookEntries: isFeatureEnabled(req.featureFlags, 'profile_guestbook') ? guestbookEntries : [],
    inboxNotifications,
    customContactItems,
    profileCompletion,
    customContactsJson: JSON.stringify(customContactItems.map((item) => ({
      label: item.label,
      value: item.value,
      href: item.href || ''
    }))),
    pageThemeColor: normalizedProfileThemeColor || '',
    pageThemeAltColor: themePair ? themePair.secondary : '',
    pageHasOwnColor: !!(normalizedProfileThemeColor),
    pageThemeButtonColor: themePair ? themePair.primaryButton : '',
    pageThemeButtonAltColor: themePair ? themePair.secondaryButton : '',
    pageThemeButtonTextColor: themePair ? themePair.primaryText : '',
    pageThemeButtonAltTextColor: themePair ? themePair.secondaryText : '',
    userReport,
    isGuestReadonly,
    isTeacherToTeacher,
    isTeacherMessageDisabled,
    isTeacherThreeWordsDisabled,
    canDeleteReceivedMessages: isOwnProfile && !isGuestReadonly && isFeatureEnabled(req.featureFlags, 'receiver_message_delete'),
    isOptedOut,
    displayName,
    canToggleOptOut: isOwnProfile && !isGuestReadonly && profile.status !== 'archived'
  });
});

router.post('/profiles/:id/like', requireLogin, verifyCsrf, (req, res) => {
  const profileId = Number(req.params.id);
  const currentUserId = Number(req.currentUser.id);
  if (!Number.isInteger(profileId) || profileId <= 0) {
    req.flash('error', 'Geçersiz profil.');
    return res.redirect('/');
  }
  if (req.currentUser.role === 'guest') {
    req.flash('error', 'Misafir profili yalnızca görüntüleme yapabilir.');
    return res.redirect(`/profiles/${profileId}`);
  }
  if (currentUserId === profileId) {
    req.flash('error', 'Kendi profilini beğenemezsin.');
    return res.redirect(`/profiles/${profileId}`);
  }

  const profile = db.prepare('SELECT id, role FROM users WHERE id = ?').get(profileId);
  if (!profile || isAdminProfile(profile)) {
    req.flash('error', 'Profil bulunamadı.');
    return res.redirect('/');
  }

  const existing = db.prepare('SELECT 1 FROM profile_likes WHERE profile_user_id = ? AND liker_user_id = ?').get(profileId, currentUserId);
  if (existing) {
    db.prepare('DELETE FROM profile_likes WHERE profile_user_id = ? AND liker_user_id = ?').run(profileId, currentUserId);
    req.flash('success', 'Profil beğenisi kaldırıldı.');
  } else {
    db.prepare(
      `INSERT INTO profile_likes (profile_user_id, liker_user_id)
       VALUES (?, ?)
       ON CONFLICT(profile_user_id, liker_user_id) DO NOTHING`
    ).run(profileId, currentUserId);
    req.flash('success', 'Profil beğenildi.');
  }

  return res.redirect(`/profiles/${profileId}`);
});

router.post('/profiles/:id/inbox-message', requireLogin, messageLimiter, verifyCsrf, (req, res) => {
  const profileId = Number(req.params.id);
  if (!Number.isInteger(profileId) || profileId <= 0) {
    req.flash('error', 'Geçersiz profil numarası.');
    return res.redirect('/');
  }
  if (!isSchoolManager(req.currentUser)) {
    req.flash('error', 'Gelen kutusuna yönetici mesajı gönderme yetkisi gereklidir.');
    return res.redirect(`/profiles/${profileId}`);
  }
  if (!isFeatureEnabled(req.featureFlags, 'profile_inbox')) {
    req.flash('error', 'Gelen kutusu özelliği şu anda kapalı.');
    return res.redirect(`/profiles/${profileId}`);
  }

  const target = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(profileId);
  if (!target || isAdminProfile(target)) {
    req.flash('error', 'Profil bulunamadı.');
    return res.redirect('/');
  }
  if (Number(target.id) === Number(req.currentUser.id)) {
    req.flash('error', 'Kendi gelen kutunuza yönetici mesajı gönderemezsiniz.');
    return res.redirect(`/profiles/${profileId}`);
  }

  const title = stripHtml(req.body.title || 'Yönetimden mesaj').slice(0, 120) || 'Yönetimden mesaj';
  const body = stripHtml(req.body.body || '').slice(0, MAX_MANAGER_INBOX_MESSAGE_LENGTH);
  if (!body) {
    req.flash('error', 'Mesaj boş olamaz.');
    return res.redirect(`/profiles/${profileId}`);
  }
  const moderation = validateContentText(db, `${title} ${body}`, { minLength: 3 });
  if (!moderation.ok) {
    req.flash('error', moderation.message);
    return res.redirect(`/profiles/${profileId}`);
  }

  createInboxNotification({
    userId: target.id,
    actorUserId: req.currentUser.id,
    kind: 'manager_message',
    title,
    body,
    linkPath: `/profiles/${target.id}#gelen-kutusu`
  });
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'manager_inbox_message_create',
    targetType: 'user',
    targetId: target.id,
    details: { targetName: target.name, title, messageLength: body.length }
  });
  req.flash('success', 'Mesaj kullanıcının gelen kutusuna gönderildi.');
  return res.redirect(`/profiles/${profileId}`);
});

router.post('/profiles/:id/message', requireLogin, messageLimiter, verifyCsrf, (req, res) => {
  const toUserId = Number(req.params.id);
  const message = stripHtml(req.body.message);

  if (req.currentUser.role === 'admin') {
    req.flash('error', 'Yonetici profilleri kapali.');
    return res.redirect('/admin');
  }

  if (req.currentUser.role === 'guest') {
    req.flash('error', 'Misafir profili yalnızca görüntüleme yapabilir.');
    return res.redirect(`/profiles/${toUserId}`);
  }

  if (!Number.isInteger(toUserId) || toUserId <= 0) {
    req.flash('error', 'Geçersiz hedef profil.');
    return res.redirect('/');
  }

  if (toUserId === req.currentUser.id) {
    req.flash('error', 'Kendinize mesaj gönderemezsiniz.');
    return res.redirect(`/profiles/${toUserId}`);
  }

  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    req.flash('error', `Mesaj zorunludur ve en fazla ${MAX_MESSAGE_LENGTH} karakter olabilir.`);
    return res.redirect(`/profiles/${toUserId}`);
  }
  const moderation = validateContentText(db, message, { minLength: 5 });
  if (!moderation.ok) {
    req.flash('error', moderation.message);
    return res.redirect(`/profiles/${toUserId}`);
  }

  const target = db.prepare('SELECT id, role, yearbook_opt_out FROM users WHERE id = ?').get(toUserId);
  if (!target) {
    req.flash('error', 'Hedef kullanıcı bulunamadı.');
    return res.redirect('/');
  }
  if (isAdminProfile(target)) {
    req.flash('error', 'Yonetici profilleri kapali.');
    return res.redirect('/');
  }
  if (target.yearbook_opt_out) {
    req.flash('error', 'Bu kullanıcı yıllığa katılmayacağı için mesaj yazılamaz.');
    return res.redirect(`/profiles/${toUserId}`);
  }

  if (req.currentUser.role === 'teacher' && target.role === 'teacher') {
    req.flash('error', 'Öğretmenler birbirine yorum yazamaz.');
    return res.redirect(`/profiles/${toUserId}`);
  }
  if (isTeacherMessageBlocked(req.featureFlags, target)) {
    req.flash('error', 'Ogretmenlere yillik yazisi su anda kapali.');
    return res.redirect(`/profiles/${toUserId}`);
  }

  try {
    if (isContentApprovalEnabled(db)) {
      const pending = db
        .prepare(
          `SELECT id FROM content_approval_requests
           WHERE actor_user_id = ? AND target_user_id = ? AND item_type IN ('profile_message', 'profile_message_edit') AND status = 'pending'
           LIMIT 1`
        )
        .get(req.currentUser.id, toUserId);
      if (pending) {
        req.flash('error', 'Bu kişi için zaten onay bekleyen bir mesajınız var.');
        return res.redirect(`/profiles/${toUserId}`);
      }
      createApprovalRequest(db, {
        itemType: 'profile_message',
        actorUserId: req.currentUser.id,
        targetUserId: toUserId,
        payload: { message }
      });
      db.prepare('DELETE FROM message_drafts WHERE from_user_id = ? AND to_user_id = ?').run(req.currentUser.id, toUserId);
      writeAuditLog({
        actorUserId: req.currentUser.id,
        action: 'content_approval_request_create',
        targetType: 'message',
        targetId: null,
        details: { itemType: 'profile_message', toUserId, messageLength: message.length }
      });
      req.flash('success', 'Mesaj onaya gönderildi. Onaylanınca profilde yayınlanacak.');
      return res.redirect(`/profiles/${toUserId}`);
    }

    db.prepare('INSERT INTO messages (from_user_id, to_user_id, message) VALUES (?, ?, ?)').run(req.currentUser.id, toUserId, message);
    db.prepare('DELETE FROM message_drafts WHERE from_user_id = ? AND to_user_id = ?').run(req.currentUser.id, toUserId);
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      req.flash('error', 'Bu kişiye zaten bir mesaj gönderdiniz.');
      return res.redirect(`/profiles/${toUserId}`);
    }
    throw error;
  }

  const created = db.prepare('SELECT id FROM messages WHERE from_user_id = ? AND to_user_id = ?').get(req.currentUser.id, toUserId);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'message_create',
    targetType: 'message',
    targetId: created ? created.id : null,
    details: { toUserId, messageLength: message.length, messagePreview: message.slice(0, 120) }
  });
  createInboxNotification({
    userId: toUserId,
    actorUserId: req.currentUser.id,
    kind: 'profile_message',
    title: 'Yeni yillik mesaji',
    body: `${req.currentUser.name} profiline bir yorum birakti.`,
    linkPath: `/profiles/${toUserId}#yorumlar`
  });
  req.flash('success', 'Mesaj gönderildi.');
  return res.redirect(`/profiles/${toUserId}`);
});

router.post('/profiles/:id/message/edit', requireLogin, messageLimiter, verifyCsrf, (req, res) => {
  const toUserId = Number(req.params.id);
  const message = stripHtml(req.body.message);

  if (req.currentUser.role === 'admin') {
    req.flash('error', 'Yonetici profilleri kapali.');
    return res.redirect('/admin');
  }

  if (req.currentUser.role === 'guest') {
    req.flash('error', 'Misafir profili yalnızca görüntüleme yapabilir.');
    return res.redirect(`/profiles/${toUserId}`);
  }

  if (!Number.isInteger(toUserId) || toUserId <= 0) {
    req.flash('error', 'Geçersiz hedef profil.');
    return res.redirect('/');
  }

  if (toUserId === req.currentUser.id) {
    req.flash('error', 'Kendinize mesaj gönderemezsiniz.');
    return res.redirect(`/profiles/${toUserId}`);
  }

  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    req.flash('error', `Mesaj zorunludur ve en fazla ${MAX_MESSAGE_LENGTH} karakter olabilir.`);
    return res.redirect(`/profiles/${toUserId}`);
  }
  const moderation = validateContentText(db, message, { minLength: 5 });
  if (!moderation.ok) {
    req.flash('error', moderation.message);
    return res.redirect(`/profiles/${toUserId}`);
  }

  const target = db.prepare('SELECT id, role, yearbook_opt_out FROM users WHERE id = ?').get(toUserId);
  if (!target) {
    req.flash('error', 'Hedef kullanıcı bulunamadı.');
    return res.redirect('/');
  }
  if (isAdminProfile(target)) {
    req.flash('error', 'Yonetici profilleri kapali.');
    return res.redirect('/');
  }
  if (target.yearbook_opt_out) {
    req.flash('error', 'Bu kullanıcı yıllığa katılmayacağı için mesaj yazılamaz.');
    return res.redirect(`/profiles/${toUserId}`);
  }

  if (req.currentUser.role === 'teacher' && target.role === 'teacher') {
    req.flash('error', 'Öğretmenler birbirine yorum yazamaz.');
    return res.redirect(`/profiles/${toUserId}`);
  }
  if (isTeacherMessageBlocked(req.featureFlags, target)) {
    req.flash('error', 'Ogretmenlere yillik yazisi su anda kapali.');
    return res.redirect(`/profiles/${toUserId}`);
  }

  const existingMessage = db
    .prepare('SELECT id FROM messages WHERE from_user_id = ? AND to_user_id = ?')
    .get(req.currentUser.id, toUserId);
  if (!existingMessage) {
    req.flash('error', 'Düzenlenecek mesaj bulunamadı.');
    return res.redirect(`/profiles/${toUserId}`);
  }

  if (isContentApprovalEnabled(db)) {
    const pending = db
      .prepare(
        `SELECT id FROM content_approval_requests
         WHERE actor_user_id = ? AND target_user_id = ? AND item_type IN ('profile_message', 'profile_message_edit') AND status = 'pending'
         LIMIT 1`
      )
      .get(req.currentUser.id, toUserId);
    if (pending) {
      req.flash('error', 'Bu kişi için zaten onay bekleyen bir mesaj düzenlemeniz var.');
      return res.redirect(`/profiles/${toUserId}`);
    }
    createApprovalRequest(db, {
      itemType: 'profile_message_edit',
      actorUserId: req.currentUser.id,
      targetUserId: toUserId,
      existingItemId: existingMessage.id,
      payload: { message }
    });
    db.prepare('DELETE FROM message_drafts WHERE from_user_id = ? AND to_user_id = ?').run(req.currentUser.id, toUserId);
    writeAuditLog({
      actorUserId: req.currentUser.id,
      action: 'content_approval_request_create',
      targetType: 'message',
      targetId: existingMessage.id,
      details: { itemType: 'profile_message_edit', toUserId, messageLength: message.length }
    });
    req.flash('success', 'Mesaj düzenlemesi onaya gönderildi. Onaylanınca yayınlanacak.');
    return res.redirect(`/profiles/${toUserId}`);
  }

  db.prepare('UPDATE messages SET message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(message, existingMessage.id);
  db.prepare('DELETE FROM message_drafts WHERE from_user_id = ? AND to_user_id = ?').run(req.currentUser.id, toUserId);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'message_edit',
    targetType: 'message',
    targetId: existingMessage.id,
    details: { toUserId, messageLength: message.length, messagePreview: message.slice(0, 120) }
  });
  req.flash('success', 'Mesaj güncellendi.');
  return res.redirect(`/profiles/${toUserId}`);
});

router.post('/profiles/:id/message/draft', requireLogin, messageLimiter, verifyCsrf, (req, res) => {
  const toUserId = Number(req.params.id);
  const draftText = stripHtml(req.body.draft_text || req.body.message);

  if (req.currentUser.role === 'admin') {
    req.flash('error', 'Yonetici profilleri kapali.');
    return res.redirect('/admin');
  }

  if (req.currentUser.role === 'guest') {
    req.flash('error', 'Misafir profili yalnızca görüntüleme yapabilir.');
    return res.redirect(`/profiles/${toUserId}`);
  }

  if (!Number.isInteger(toUserId) || toUserId <= 0 || toUserId === req.currentUser.id) {
    req.flash('error', 'Geçersiz hedef profil.');
    return res.redirect('/');
  }
  const target = db.prepare('SELECT id, role, yearbook_opt_out FROM users WHERE id = ?').get(toUserId);
  if (!target) {
    req.flash('error', 'Hedef kullanıcı bulunamadı.');
    return res.redirect('/');
  }
  if (isAdminProfile(target)) {
    req.flash('error', 'Yonetici profilleri kapali.');
    return res.redirect('/');
  }
  if (target.yearbook_opt_out) {
    req.flash('error', 'Bu kullanıcı yıllığa katılmayacağı için mesaj taslağı kaydedilemez.');
    return res.redirect(`/profiles/${toUserId}`);
  }
  if (req.currentUser.role === 'teacher' && target.role === 'teacher') {
    req.flash('error', 'Öğretmenler birbirine yorum taslağı kaydedemez.');
    return res.redirect(`/profiles/${toUserId}`);
  }
  if (isTeacherMessageBlocked(req.featureFlags, target)) {
    req.flash('error', 'Ogretmenlere yillik yazisi su anda kapali.');
    return res.redirect(`/profiles/${toUserId}`);
  }

  if (!draftText || draftText.length > MAX_MESSAGE_LENGTH) {
    req.flash('error', `Taslak en fazla ${MAX_MESSAGE_LENGTH} karakter olabilir.`);
    return res.redirect(`/profiles/${toUserId}`);
  }

  db.prepare(
    `INSERT INTO message_drafts (from_user_id, to_user_id, draft_text)
     VALUES (?, ?, ?)
     ON CONFLICT(from_user_id, to_user_id)
     DO UPDATE SET draft_text = excluded.draft_text, updated_at = CURRENT_TIMESTAMP`
  ).run(req.currentUser.id, toUserId, draftText);

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'message_draft_save',
    targetType: 'message_draft',
    targetId: null,
    details: { toUserId, draftLength: draftText.length, draftPreview: draftText.slice(0, 120) }
  });
  req.flash('success', 'Taslak kaydedildi.');
  return res.redirect(`/profiles/${toUserId}`);
});

router.post('/profiles/:profileId/messages/:messageId/flag', requireLogin, messageLimiter, verifyCsrf, (req, res) => {
  const profileId = Number(req.params.profileId);
  const messageId = Number(req.params.messageId);
  const reason = stripHtml(req.body.reason).slice(0, 400);

  if (!reason) {
    req.flash('error', 'Bildirim nedeni zorunludur.');
    return res.redirect(`/profiles/${profileId}`);
  }

  const message = db.prepare('SELECT id, from_user_id FROM messages WHERE id = ? AND to_user_id = ?').get(messageId, profileId);
  if (!message) {
    req.flash('error', 'Mesaj bulunamadı.');
    return res.redirect(`/profiles/${profileId}`);
  }

  if (message.from_user_id === req.currentUser.id) {
    req.flash('error', 'Kendi mesajınızı bildiremezsiniz.');
    return res.redirect(`/profiles/${profileId}`);
  }

  try {
    db.prepare(
      `INSERT INTO message_flags (message_id, reporter_user_id, reason)
       VALUES (?, ?, ?)`
    ).run(messageId, req.currentUser.id, reason);
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      req.flash('error', 'Bu mesaj için zaten bildirim gönderdiniz.');
      return res.redirect(`/profiles/${profileId}`);
    }
    throw error;
  }

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'message_flag_create',
    targetType: 'message',
    targetId: messageId,
    details: { profileId, reasonLength: reason.length, reasonPreview: reason.slice(0, 120) }
  });
  req.flash('success', 'Mesaj moderasyon kuyruğuna gönderildi.');
  return res.redirect(`/profiles/${profileId}`);
});

router.post('/profiles/:id/messages/:msgId/toggle-priority', requireLogin, verifyCsrf, (req, res) => {
  const profileId = Number(req.params.id);
  const messageId = Number(req.params.msgId);
  if (!Number.isInteger(profileId) || profileId <= 0 || !Number.isInteger(messageId) || messageId <= 0) {
    return res.redirect('/');
  }
  if (Number(req.currentUser.id) !== profileId) {
    req.flash('error', 'Bu işlem için yetkiniz yok.');
    return res.redirect(`/profiles/${profileId}`);
  }
  const message = db.prepare('SELECT id, is_export_priority FROM messages WHERE id = ? AND to_user_id = ?').get(messageId, profileId);
  if (!message) {
    req.flash('error', 'Mesaj bulunamadı.');
    return res.redirect(`/profiles/${profileId}`);
  }
  const newPriority = message.is_export_priority ? 0 : 1;
  db.prepare('UPDATE messages SET is_export_priority = ? WHERE id = ?').run(newPriority, messageId);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'message_priority_toggle',
    targetType: 'message',
    targetId: messageId,
    details: { profileId, is_export_priority: newPriority }
  });
  return res.redirect(`/profiles/${profileId}#yorumlar`);
});

router.post('/profiles/:id/messages/:msgId/delete-received', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'receiver_message_delete', `/profiles/${Number(req.params.id) || ''}`, 'Mesaj silme özelliği şu anda kapalı.')) {
    return;
  }
  const profileId = Number(req.params.id);
  const messageId = Number(req.params.msgId);
  if (!Number.isInteger(profileId) || profileId <= 0 || !Number.isInteger(messageId) || messageId <= 0) {
    return res.redirect('/');
  }
  if (Number(req.currentUser.id) !== profileId) {
    req.flash('error', 'Sadece kendi profilinize gelen mesajları silebilirsiniz.');
    return res.redirect(`/profiles/${profileId}`);
  }
  const message = db.prepare('SELECT id, from_user_id FROM messages WHERE id = ? AND to_user_id = ?').get(messageId, profileId);
  if (!message) {
    req.flash('error', 'Mesaj bulunamadı.');
    return res.redirect(`/profiles/${profileId}`);
  }
  db.prepare('DELETE FROM messages WHERE id = ?').run(messageId);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'receiver_message_delete',
    targetType: 'message',
    targetId: messageId,
    details: { profileId, fromUserId: message.from_user_id }
  });
  req.flash('success', 'Mesaj profilinizden silindi.');
  return res.redirect(`/profiles/${profileId}#yorumlar`);
});

router.post('/profiles/:id/report', requireLogin, messageLimiter, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'user_reports', `/profiles/${Number(req.params.id) || ''}`, 'Kullanıcı bildirimi şu anda kapalı.')) {
    return;
  }
  const profileId = Number(req.params.id);
  const reason = stripHtml(req.body.reason).slice(0, 400);

  if (!Number.isInteger(profileId) || profileId <= 0) {
    req.flash('error', 'Gecersiz profil numarasi.');
    return res.redirect('/');
  }

  if (req.currentUser.role === 'guest') {
    req.flash('error', 'Misafir profili bildirim gonderemez.');
    return res.redirect(`/profiles/${profileId}`);
  }
  if (req.currentUser.role === 'admin') {
    req.flash('error', 'Yonetici hesaplari profil bildirimi gonderemez.');
    return res.redirect('/admin');
  }

  if (!reason) {
    req.flash('error', 'Bildirim nedeni zorunludur.');
    return res.redirect(`/profiles/${profileId}`);
  }

  const target = db
    .prepare('SELECT id, role, name FROM users WHERE id = ?')
    .get(profileId);

  if (!target) {
    req.flash('error', 'Profil bulunamadi.');
    return res.redirect('/');
  }

  if (target.id === req.currentUser.id) {
    req.flash('error', 'Kendinizi bildiremezsiniz.');
    return res.redirect(`/profiles/${profileId}`);
  }

  if (isAdminProfile(target)) {
    req.flash('error', 'Yonetici hesaplari bildirilemez.');
    return res.redirect('/');
  }

  try {
    db.prepare(
      `INSERT INTO user_reports (reported_user_id, reporter_user_id, reason)
       VALUES (?, ?, ?)`
    ).run(profileId, req.currentUser.id, reason);
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      req.flash('error', 'Bu kullanici icin zaten bildirim gonderdiniz.');
      return res.redirect(`/profiles/${profileId}`);
    }
    throw error;
  }

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'user_report_create',
    targetType: 'user',
    targetId: profileId,
    details: { targetName: target.name }
  });
  req.flash('success', 'Kullanici moderasyon kuyruguna gonderildi.');
  return res.redirect(`/profiles/${profileId}`);
});

router.post('/profiles/me/slogan', requireLogin, verifyCsrf, (req, res) => {
  if (req.currentUser.role === 'admin') {
    req.flash('error', 'Yonetici profilleri kapali.');
    return res.redirect('/admin');
  }
  if (req.currentUser.role === 'guest') {
    req.flash('error', 'Misafir profili yalnızca görüntüleme yapabilir.');
    return res.redirect(`/profiles/${req.currentUser.id}`);
  }

  const slogan = stripHtml(req.body.slogan);
  const bio = stripHtml(req.body.bio);
  const freeText = stripHtml(req.body.free_text);
  const favoriteMemory = stripHtml(req.body.favorite_memory);
  const favoriteQuote = stripHtml(req.body.favorite_quote);
  const birthDate = stripHtml(req.body.birth_date || '').slice(0, 10);
  const profileThemeColor = stripHtml(req.body.profile_theme_color || '').slice(0, 20);
  const contactPhone = stripHtml(req.body.contact_phone || '').slice(0, 40);
  const contactEmail = stripHtml(req.body.contact_email || '').slice(0, 120);
  const contactInstagram = stripHtml(req.body.contact_instagram || '').slice(0, 120);
  const contactX = stripHtml(req.body.contact_x || '').slice(0, 120);
  const contactFacebook = stripHtml(req.body.contact_facebook || '').slice(0, 120);
  const contactLinkedin = stripHtml(req.body.contact_linkedin || '').slice(0, 120);
  const contactNsocial = stripHtml(req.body.contact_nsocial || '').slice(0, 120);
  const customContacts = normalizeCustomContacts(req.body.custom_contacts_json || '[]');
  const customContactsJson = JSON.stringify(customContacts);

  if (slogan.length > MAX_SLOGAN_LENGTH) {
    req.flash('error', `Slogan en fazla ${MAX_SLOGAN_LENGTH} karakter olabilir.`);
    return res.redirect(`/profiles/${req.currentUser.id}`);
  }
  if (bio.length > MAX_PROFILE_BIO_LENGTH) {
    req.flash('error', `Biyografi en fazla ${MAX_PROFILE_BIO_LENGTH} karakter olabilir.`);
    return res.redirect(`/profiles/${req.currentUser.id}`);
  }
  if (freeText.length > MAX_PROFILE_FREE_TEXT_LENGTH) {
    req.flash('error', `Serbest yazı alanı en fazla ${MAX_PROFILE_FREE_TEXT_LENGTH} karakter olabilir.`);
    return res.redirect(`/profiles/${req.currentUser.id}`);
  }
  if (favoriteMemory.length > MAX_PROFILE_MEMORY_LENGTH) {
    req.flash('error', `Anı en fazla ${MAX_PROFILE_MEMORY_LENGTH} karakter olabilir.`);
    return res.redirect(`/profiles/${req.currentUser.id}`);
  }
  if (favoriteQuote.length > MAX_PROFILE_QUOTE_LENGTH) {
    req.flash('error', `Alıntı en fazla ${MAX_PROFILE_QUOTE_LENGTH} karakter olabilir.`);
    return res.redirect(`/profiles/${req.currentUser.id}`);
  }
  if (birthDate && !BIRTH_DATE_PATTERN.test(birthDate)) {
    req.flash('error', 'Doğum tarihi YYYY-AA-GG formatında olmalıdır.');
    return res.redirect(`/profiles/${req.currentUser.id}`);
  }
  if (profileThemeColor && !HEX_COLOR_PATTERN.test(profileThemeColor)) {
    req.flash('error', 'Profil tema rengi geçersiz.');
    return res.redirect(`/profiles/${req.currentUser.id}`);
  }
  if (profileThemeColor && !isReadableThemeColor(profileThemeColor)) {
    req.flash('error', 'Profil tema rengi çok acik veya cok koyu olamaz.');
    return res.redirect(`/profiles/${req.currentUser.id}`);
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    req.flash('error', 'E-posta adresi geçersiz.');
    return res.redirect(`/profiles/${req.currentUser.id}`);
  }
  const moderation = validateTextFields(db, [
    { value: slogan, minLength: 2 },
    { value: bio, minLength: 5 },
    { value: freeText, minLength: 5 },
    { value: favoriteMemory, minLength: 5 },
    { value: favoriteQuote, minLength: 2 }
  ].concat(customContacts.flatMap((item) => [
    { value: item.label, minLength: 2 },
    { value: item.value, minLength: 2 }
  ])));
  if (!moderation.ok) {
    req.flash('error', moderation.message);
    return res.redirect(`/profiles/${req.currentUser.id}`);
  }

  const safeProfileThemeColor = profileThemeColor ? normalizeThemeColor(profileThemeColor) : '';

  if (isContentApprovalEnabled(db)) {
    const pending = db
      .prepare(
        "SELECT id FROM content_approval_requests WHERE actor_user_id = ? AND item_type = 'profile_details' AND status = 'pending' LIMIT 1"
      )
      .get(req.currentUser.id);
    if (pending) {
      req.flash('error', 'Profil yazıları ve iletişim bilgileri için zaten onay bekleyen bir güncelleme var.');
      return res.redirect(`/profiles/${req.currentUser.id}`);
    }
    createApprovalRequest(db, {
      itemType: 'profile_details',
      actorUserId: req.currentUser.id,
      targetUserId: req.currentUser.id,
      payload: {
        slogan,
        bio,
        freeText,
        favoriteMemory,
        favoriteQuote,
        birthDate: birthDate || null,
        profileThemeColor: safeProfileThemeColor,
        contactPhone,
        contactEmail,
        contactInstagram,
        contactX,
        contactFacebook,
        contactLinkedin,
        contactNsocial,
        customContactsJson
      }
    });
    writeAuditLog({
      actorUserId: req.currentUser.id,
      action: 'content_approval_request_create',
      targetType: 'user',
      targetId: req.currentUser.id,
      details: { itemType: 'profile_details', profileThemeColor: safeProfileThemeColor || null }
    });
    req.flash('success', 'Profil yazıları ve iletişim bilgileri onaya gönderildi. Onaylanınca yayınlanacak.');
    return res.redirect(`/profiles/${req.currentUser.id}`);
  }

  db.prepare(
    `UPDATE users
     SET slogan = ?, bio = ?, free_text = ?, favorite_memory = ?, favorite_quote = ?, birth_date = ?, profile_theme_color = ?,
         contact_phone = ?, contact_email = ?, contact_instagram = ?, contact_x = ?, contact_facebook = ?,
         contact_linkedin = ?, contact_nsocial = ?, custom_contacts_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(
    slogan,
    bio,
    freeText,
    favoriteMemory,
    favoriteQuote,
    birthDate || null,
    safeProfileThemeColor,
    contactPhone,
    contactEmail,
    contactInstagram,
    contactX,
    contactFacebook,
    contactLinkedin,
    contactNsocial,
    customContactsJson,
    req.currentUser.id
  );
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'profile_details_update',
    targetType: 'user',
    targetId: req.currentUser.id,
    details: { profileThemeColor: safeProfileThemeColor || null }
  });
  req.flash('success', 'Profil bilgileri güncellendi.');
  return res.redirect(`/profiles/${req.currentUser.id}`);
});

router.post('/profiles/me/photo', requireLogin, verifyCsrf, ensurePhotoUploadAllowed, photoUpload.single('photo'), async (req, res) => {
  if (req.currentUser.role === 'admin') {
    req.flash('error', 'Yonetici profilleri kapali.');
    return res.redirect('/admin');
  }
  if (!req.file) {
    req.flash('error', 'Lütfen bir görsel dosyası seçin.');
    return res.redirect(`/profiles/${req.currentUser.id}`);
  }

  const existingPhoto = db.prepare('SELECT photo_path FROM users WHERE id = ?').get(req.currentUser.id);
  try {
    assertImageSignature(req.file);
  } catch (error) {
    deleteFileIfExists(`/uploads/photos/${req.file.filename}`);
    throw error;
  }
  await compressImage(req.file.path);
  const relativePath = `/uploads/photos/${req.file.filename}`;
  db.prepare('UPDATE users SET photo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(relativePath, req.currentUser.id);
  deleteFileIfExists(existingPhoto && existingPhoto.photo_path);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'profile_photo_update',
    targetType: 'user',
    targetId: req.currentUser.id,
    details: {}
  });

  req.flash('success', 'Profil fotoğrafı güncellendi.');
  return res.redirect(`/profiles/${req.currentUser.id}`);
});

router.post('/profiles/me/photo/delete', requireLogin, verifyCsrf, ensurePhotoUploadAllowed, (req, res) => {
  if (req.currentUser.role === 'admin') {
    req.flash('error', 'Yonetici profilleri kapali.');
    return res.redirect('/admin');
  }

  const existingPhoto = db.prepare('SELECT photo_path FROM users WHERE id = ?').get(req.currentUser.id);
  db.prepare('UPDATE users SET photo_path = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.currentUser.id);
  deleteFileIfExists(existingPhoto && existingPhoto.photo_path);
  req.flash('success', 'Profil fotoğrafı kaldırıldı.');
  return res.redirect(`/profiles/${req.currentUser.id}`);
});

router.post('/profiles/me/cover', requireLogin, verifyCsrf, ensureCoverUploadAllowed, photoUpload.single('cover_photo'), async (req, res) => {
  if (req.currentUser.role === 'admin') {
    req.flash('error', 'Yonetici profilleri kapali.');
    return res.redirect('/admin');
  }
  if (!req.file) {
    req.flash('error', 'Lütfen bir kapak görseli seçin.');
    return res.redirect(`/profiles/${req.currentUser.id}`);
  }

  const current = db.prepare('SELECT profile_cover_path FROM users WHERE id = ?').get(req.currentUser.id);
  try {
    assertImageSignature(req.file);
  } catch (error) {
    deleteFileIfExists(`/uploads/photos/${req.file.filename}`);
    throw error;
  }
  await compressImage(req.file.path);
  const relativePath = `/uploads/photos/${req.file.filename}`;
  db.prepare('UPDATE users SET profile_cover_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(relativePath, req.currentUser.id);
  deleteFileIfExists(current && current.profile_cover_path);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'profile_cover_update',
    targetType: 'user',
    targetId: req.currentUser.id,
    details: {}
  });
  req.flash('success', 'Profil kapağı güncellendi.');
  return res.redirect(`/profiles/${req.currentUser.id}`);
});

router.post('/profiles/me/cover/delete', requireLogin, verifyCsrf, ensureCoverUploadAllowed, (req, res) => {
  if (req.currentUser.role === 'admin') {
    req.flash('error', 'Yonetici profilleri kapali.');
    return res.redirect('/admin');
  }

  const existingCover = db.prepare('SELECT profile_cover_path FROM users WHERE id = ?').get(req.currentUser.id);
  db.prepare('UPDATE users SET profile_cover_path = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.currentUser.id);
  deleteFileIfExists(existingCover && existingCover.profile_cover_path);
  req.flash('success', 'Kapak görseli kaldırıldı.');
  return res.redirect(`/profiles/${req.currentUser.id}`);
});

router.post('/profiles/:id/three-words', requireLogin, verifyCsrf, (req, res) => {
  const profileId = Number(req.params.id);
  const words = stripHtml(req.body.words).slice(0, MAX_THREE_WORDS_LENGTH);

  if (req.currentUser.role === 'admin') {
    req.flash('error', 'Yonetici profilleri kapali.');
    return res.redirect('/admin');
  }

  if (req.currentUser.role === 'guest') {
    req.flash('error', 'Misafir profili yalnızca görüntüleme yapabilir.');
    return res.redirect(`/profiles/${profileId}`);
  }
  if (!Number.isInteger(profileId) || profileId <= 0 || profileId === req.currentUser.id) {
    req.flash('error', 'Geçersiz hedef profil.');
    return res.redirect('/');
  }
  if (!words) {
    req.flash('error', 'En az bir kelime yazmalısınız.');
    return res.redirect(`/profiles/${profileId}`);
  }
  const moderation = validateContentText(db, words, { minLength: 2 });
  if (!moderation.ok) {
    req.flash('error', moderation.message);
    return res.redirect(`/profiles/${profileId}`);
  }
  const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(profileId);
  if (!target || isAdminProfile(target)) {
    req.flash('error', 'Yonetici profilleri kapali.');
    return res.redirect('/');
  }
  if (isTeacherThreeWordsBlocked(req.featureFlags, target)) {
    req.flash('error', 'Ogretmenlere 3 kelime yazisi su anda kapali.');
    return res.redirect(`/profiles/${profileId}`);
  }

  if (isContentApprovalEnabled(db)) {
    const pending = db
      .prepare(
        "SELECT id FROM content_approval_requests WHERE actor_user_id = ? AND target_user_id = ? AND item_type = 'profile_three_words' AND status = 'pending' LIMIT 1"
      )
      .get(req.currentUser.id, profileId);
    if (pending) {
      req.flash('error', 'Bu profil için zaten onay bekleyen 3 kelime yorumunuz var.');
      return res.redirect(`/profiles/${profileId}`);
    }
    createApprovalRequest(db, {
      itemType: 'profile_three_words',
      actorUserId: req.currentUser.id,
      targetUserId: profileId,
      payload: { words }
    });
    writeAuditLog({
      actorUserId: req.currentUser.id,
      action: 'content_approval_request_create',
      targetType: 'user',
      targetId: profileId,
      details: { itemType: 'profile_three_words' }
    });
    req.flash('success', '3 kelimelik yorum onaya gönderildi.');
    return res.redirect(`/profiles/${profileId}`);
  }

  db.prepare(
    `INSERT INTO profile_three_words (profile_user_id, author_user_id, words)
     VALUES (?, ?, ?)
     ON CONFLICT(profile_user_id, author_user_id)
     DO UPDATE SET words = excluded.words, updated_at = CURRENT_TIMESTAMP`
  ).run(profileId, req.currentUser.id, words);

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'profile_three_words_upsert',
    targetType: 'user',
    targetId: profileId,
    details: {}
  });
  req.flash('success', '3 kelimelik yorum kaydedildi.');
  return res.redirect(`/profiles/${profileId}`);
});

router.post('/profiles/:id/guestbook', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'profile_guestbook', `/profiles/${Number(req.params.id) || ''}`)) {
    return;
  }
  const profileId = Number(req.params.id);
  const body = stripHtml(req.body.body || '').slice(0, MAX_GUESTBOOK_LENGTH);

  if (req.currentUser.role === 'guest') {
    req.flash('error', 'Misafir profili yalnızca görüntüleme yapabilir.');
    return res.redirect(`/profiles/${profileId}`);
  }
  if (!Number.isInteger(profileId) || profileId <= 0 || profileId === req.currentUser.id) {
    req.flash('error', 'Geçersiz profil.');
    return res.redirect('/');
  }
  if (!body) {
    req.flash('error', 'Ziyaretçi defteri notu boş olamaz.');
    return res.redirect(`/profiles/${profileId}`);
  }
  const moderation = validateContentText(db, body, { minLength: 5 });
  if (!moderation.ok) {
    req.flash('error', moderation.message);
    return res.redirect(`/profiles/${profileId}`);
  }

  const profile = db.prepare('SELECT id FROM users WHERE id = ?').get(profileId);
  if (!profile) {
    req.flash('error', 'Profil bulunamadı.');
    return res.redirect('/');
  }

  if (isContentApprovalEnabled(db)) {
    createApprovalRequest(db, {
      itemType: 'profile_guestbook',
      actorUserId: req.currentUser.id,
      targetUserId: profileId,
      payload: { body }
    });
    writeAuditLog({
      actorUserId: req.currentUser.id,
      action: 'content_approval_request_create',
      targetType: 'profile_guestbook_entry',
      targetId: null,
      details: { itemType: 'profile_guestbook', profileId }
    });
    req.flash('success', 'Ziyaretçi defteri notu onaya gönderildi.');
    return res.redirect(`/profiles/${profileId}`);
  }

  const result = db.prepare(
    `INSERT INTO profile_guestbook_entries (profile_user_id, author_user_id, body)
     VALUES (?, ?, ?)`
  ).run(profileId, req.currentUser.id, body);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'profile_guestbook_create',
    targetType: 'profile_guestbook_entry',
    targetId: Number(result.lastInsertRowid),
    details: { profileId }
  });
  createInboxNotification({
    userId: profileId,
    actorUserId: req.currentUser.id,
    kind: 'guestbook_entry',
    title: 'Yeni ziyaretci defteri notu',
    body: `${req.currentUser.name} profiline not birakti.`,
    linkPath: `/profiles/${profileId}#ziyaretci-defteri`
  });
  req.flash('success', 'Ziyaretçi defteri notu eklendi.');
  return res.redirect(`/profiles/${profileId}`);
});

router.post('/profiles/:profileId/guestbook/:entryId/delete', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'profile_guestbook', `/profiles/${Number(req.params.profileId) || ''}`)) {
    return;
  }
  const profileId = Number(req.params.profileId);
  const entryId = Number(req.params.entryId);

  const entry = db
    .prepare('SELECT id, author_user_id FROM profile_guestbook_entries WHERE id = ? AND profile_user_id = ?')
    .get(entryId, profileId);
  if (!entry) {
    req.flash('error', 'Ziyaretçi defteri notu bulunamadı.');
    return res.redirect(`/profiles/${profileId}`);
  }
  if (!canDeleteGuestbookEntry(req.currentUser, profileId, entry)) {
    req.flash('error', 'Bu notu silme yetkiniz yok.');
    return res.redirect(`/profiles/${profileId}`);
  }

  db.prepare('DELETE FROM profile_guestbook_entries WHERE id = ?').run(entryId);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'profile_guestbook_delete',
    targetType: 'profile_guestbook_entry',
    targetId: entryId,
    details: { profileId }
  });
  req.flash('success', 'Ziyaretçi defteri notu silindi.');
  return res.redirect(`/profiles/${profileId}`);
});

router.post('/profiles/:profileId/messages/:messageId/feature', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'profile_featured_message', `/profiles/${Number(req.params.profileId) || ''}`)) {
    return;
  }
  const profileId = Number(req.params.profileId);
  const messageId = Number(req.params.messageId);

  if (!Number.isInteger(profileId) || profileId <= 0 || !Number.isInteger(messageId) || messageId <= 0) {
    req.flash('error', 'Geçersiz mesaj seçimi.');
    return res.redirect('/');
  }
  if (Number(req.currentUser.id) !== profileId && req.currentUser.role !== 'admin') {
    req.flash('error', 'Bu profil için öne çıkan mesaj belirleme yetkiniz yok.');
    return res.redirect(`/profiles/${profileId}`);
  }

  const message = db.prepare('SELECT id FROM messages WHERE id = ? AND to_user_id = ?').get(messageId, profileId);
  if (!message) {
    req.flash('error', 'Mesaj bulunamadı.');
    return res.redirect(`/profiles/${profileId}`);
  }

  db.prepare('UPDATE users SET featured_message_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(messageId, profileId);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'profile_featured_message_set',
    targetType: 'message',
    targetId: messageId,
    details: { profileId }
  });
  req.flash('success', 'Mesaj profile sabitlendi.');
  return res.redirect(`/profiles/${profileId}`);
});

router.post('/profiles/:profileId/messages/feature/clear', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'profile_featured_message', `/profiles/${Number(req.params.profileId) || ''}`)) {
    return;
  }
  const profileId = Number(req.params.profileId);
  if (!Number.isInteger(profileId) || profileId <= 0) {
    req.flash('error', 'Geçersiz profil.');
    return res.redirect('/');
  }
  if (Number(req.currentUser.id) !== profileId && req.currentUser.role !== 'admin') {
    req.flash('error', 'Bu profil için öne çıkan mesajı kaldırma yetkiniz yok.');
    return res.redirect(`/profiles/${profileId}`);
  }

  db.prepare('UPDATE users SET featured_message_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(profileId);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'profile_featured_message_clear',
    targetType: 'user',
    targetId: profileId,
    details: {}
  });
  req.flash('success', 'Öne çıkan mesaj kaldırıldı.');
  return res.redirect(`/profiles/${profileId}`);
});

router.post('/profiles/me/inbox/clear', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'profile_inbox', `/profiles/${req.currentUser.id}`, 'Gelen kutusu şu anda kapalı.')) {
    return;
  }
  if (req.currentUser.role === 'admin') {
    req.flash('error', 'Yonetici profilleri kapali.');
    return res.redirect('/admin');
  }
  db.prepare('DELETE FROM inbox_notifications WHERE user_id = ?').run(req.currentUser.id);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'inbox_clear',
    targetType: 'inbox',
    targetId: req.currentUser.id,
    details: {}
  });
  req.flash('success', 'Gelen kutusu temizlendi.');
  return res.redirect(`/profiles/${req.currentUser.id}#gelen-kutusu`);
});

router.post('/profiles/me/toggle-opt-out', requireLogin, requireLiveOwnProfile, verifyCsrf, (req, res) => {
  const userId = req.currentUser.id;
  const current = db.prepare('SELECT yearbook_opt_out FROM users WHERE id = ?').get(userId);
  if (!current) return res.redirect('/');
  const newValue = current.yearbook_opt_out ? 0 : 1;
  db.prepare('UPDATE users SET yearbook_opt_out = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newValue, userId);
  writeAuditLog({
    actorUserId: userId,
    action: newValue ? 'yearbook_opt_out' : 'yearbook_opt_in',
    targetType: 'user',
    targetId: userId,
    details: {}
  });
  req.flash('success', newValue ? 'Yıllık katılımınız kapatıldı. Adınız gizlenecek ve kimse size mesaj yazamayacak.' : 'Yıllık katılımınız tekrar açıldı.');
  return res.redirect(`/profiles/${userId}`);
});

router.post('/profiles/me/delete-account', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'self_account_delete', `/profiles/${req.currentUser.id}`, 'Hesap silme özelliği şu anda kapalı.')) {
    return null;
  }
  const accessCode = stripHtml(req.body.access_code || '');

  if (!accessCode) {
    req.flash('error', 'Hesabı silmek için erişim kodu zorunludur.');
    return res.redirect(`/profiles/${req.currentUser.id}`);
  }

  const user = db
    .prepare('SELECT id, role, name, access_code_hash, photo_path, profile_cover_path FROM users WHERE id = ?')
    .get(req.currentUser.id);

  if (!user) {
    return req.session.destroy(() => {
      res.redirect('/logged-out?reason=manual');
    });
  }

  if (user.role === 'admin') {
    req.flash('error', 'Yönetici hesapları bu ekran üzerinden silinemez.');
    return res.redirect('/admin');
  }

  if (!verifyAccessCode(accessCode, user.access_code_hash)) {
    writeAuditLog({
      actorUserId: req.currentUser.id,
      action: 'self_account_delete_blocked',
      targetType: 'user',
      targetId: req.currentUser.id,
      details: { reason: 'invalid_access_code' }
    });
    req.flash('error', 'Erişim kodu hatalı. Hesap silme işlemi iptal edildi.');
    return res.redirect(`/profiles/${req.currentUser.id}`);
  }

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'self_account_delete',
    targetType: 'user',
    targetId: req.currentUser.id,
    details: { name: user.name, role: user.role }
  });

  deleteFileIfExists(user.photo_path);
  deleteFileIfExists(user.profile_cover_path);
  db.prepare('DELETE FROM users WHERE id = ?').run(req.currentUser.id);

  return req.session.destroy(() => {
    res.redirect('/logged-out?reason=manual');
  });
});

router.use((error, req, res, next) => {
  if (error && error.message) {
    req.flash('error', error.message);
    return res.redirect(req.currentUser && req.currentUser.role === 'admin' ? '/admin' : `/profiles/${req.currentUser ? req.currentUser.id : ''}`);
  }
  return next(error);
});

module.exports = router;
