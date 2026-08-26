const fs = require('fs');
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { db, getActiveClassBranches, isValidClassBranch } = require('../db');
const { CLASS_COVER_UPLOAD_DIR, MAX_UPLOAD_SIZE_BYTES } = require('../config');
const { verifyCsrf } = require('../middleware/csrf');
const { stripHtml, normalizeTurkishSearchText } = require('../utils/sanitize');
const { requireAdmin, requireLogin, requireAnnouncementPublisher } = require('../middleware/auth');
const { assertImageSignature, getSafeImageExtension, isAllowedImageMime } = require('../utils/uploadValidation');
const { safeRedirectPath } = require('../utils/redirects');
const { deleteFileIfExists } = require('../utils/files');
const { writeAuditLog } = require('../utils/auditLog');
const { buildFeatureFlags, isFeatureEnabled } = require('../utils/features');
const { compareTurkishText, compareUsersTurkish } = require('../utils/sort');
const { buildThemeAccentPair, isReadableThemeColor, normalizeThemeColor } = require('../utils/colors');
const { createApprovalRequest, isContentApprovalEnabled } = require('../utils/contentApproval');
const { validateContentText } = require('../utils/contentModeration');
const { logError } = require('../utils/logger');

const router = express.Router();

if (!fs.existsSync(CLASS_COVER_UPLOAD_DIR)) {
  fs.mkdirSync(CLASS_COVER_UPLOAD_DIR, { recursive: true });
}

const classCoverStorage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, CLASS_COVER_UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = getSafeImageExtension(file.mimetype);
    cb(null, `class-cover-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
  }
});

const classCoverUpload = multer({
  storage: classCoverStorage,
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
  fileFilter: (_, file, cb) => {
    if (!isAllowedImageMime(file.mimetype)) {
      return cb(new Error('Yalnızca görsel dosyaları yüklenebilir.'));
    }
    return cb(null, true);
  }
});

const announcementPublishLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Çok sık duyuru gönderildi. Lütfen biraz sonra tekrar deneyin.'
});
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const MAX_FAREWELL_LENGTH = 800;
const MAX_CUSTOM_CONTACTS = 12;
const MAX_CUSTOM_CONTACT_LABEL_LENGTH = 40;
const MAX_CUSTOM_CONTACT_VALUE_LENGTH = 160;

function teacherCategoryLabel(category) {
  switch (category) {
    case 'teacher':
      return 'Öğretmen';
    case 'principal':
      return 'Müdür';
    case 'vice_principal':
      return 'Müdür Yardımcısı';
    case 'head_vice_principal':
      return 'Baş Müdür Yardımcısı';
    default:
      return 'Diğer';
  }
}

function canEditClassPage(user, branch) {
  return Boolean(
    user &&
      (user.role === 'admin' || (user.role === 'student' && user.president_class_branch === branch && user.class_branch === branch))
  );
}

function canPublishAnnouncements(user) {
  return Boolean(user && ['admin', 'teacher'].includes(user.role));
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

function canPostClassMemory(user, branch) {
  return Boolean(
    user &&
      (user.role === 'admin' || (user.role === 'student' && user.class_branch === branch))
  );
}

function getArchiveStudentWhere(user, extraWhere = '') {
  const where = [`role = 'student'`];
  const params = [];
  if (extraWhere) where.push(extraWhere);
  if (user && user.role !== 'admin') {
    where.push('school_id = ?');
    params.push(Number(user.school_id || 0));
  }
  return { where: where.join(' AND '), params };
}

function canVoteInClassPoll(user, branch) {
  return Boolean(
    user &&
      (user.role === 'admin' || (user.role === 'student' && user.class_branch === branch))
  );
}

function canDeleteClassMemory(user, memory, branch) {
  return Boolean(
    user &&
      (user.role === 'admin' ||
        (user.role === 'student' &&
          ((user.class_branch === branch && user.president_class_branch === branch) || user.id === memory.created_by_user_id)))
  );
}

function requireFeature(req, res, key, redirectTo = '/', message = 'Bu özellik şu anda kapalı.') {
  if (isFeatureEnabled(req.featureFlags || {}, key)) {
    return true;
  }
  req.flash('error', message);
  res.redirect(redirectTo);
  return false;
}

function redirectToLoginOrInactive(req, res) {
  if (req.sessionInactive) {
    return res.redirect('/logged-out?reason=inactive');
  }
  return res.redirect('/login');
}

router.get('/', (req, res) => {
  if (!req.currentUser) {
    return redirectToLoginOrInactive(req, res);
  }

  const classStats = db
    .prepare(
      `SELECT c.branch AS class_branch, COUNT(u.id) as total,
              c.theme_color,
              cp.cover_photo_path,
              cp.class_slogan,
              president.id AS president_id,
              president.name AS president_name,
              president.photo_path AS president_photo_path
       FROM classes c
       LEFT JOIN users u ON u.class_branch = c.branch AND u.role = 'student'
       LEFT JOIN class_pages cp ON cp.class_branch = c.branch
       LEFT JOIN users president ON president.president_class_branch = c.branch
       WHERE c.is_active = 1 AND c.is_archived = 0 AND c.deleted_at IS NULL
       GROUP BY
         c.branch,
         c.theme_color,
         cp.cover_photo_path,
         cp.class_slogan,
         president.id,
         president.name,
         president.photo_path
       ORDER BY c.branch`
    )
    .all();

  const teachersCount = db.prepare("SELECT COUNT(*) as total FROM users WHERE role = 'teacher'").get().total;

  const latestMessages = db
    .prepare(
      `SELECT m.id, m.message, m.created_at,
              sender.id as sender_id, sender.name as sender_name,
              receiver.id as receiver_id, receiver.name as receiver_name
       FROM messages m
       JOIN users sender ON sender.id = m.from_user_id
       JOIN users receiver ON receiver.id = m.to_user_id
       ORDER BY m.created_at DESC
       LIMIT 15`
    )
    .all();

  const announcements = db
    .prepare(
      `SELECT a.id, a.title, a.body, a.created_at, u.name AS author_name
       FROM announcements a
       JOIN users u ON u.id = a.created_by_user_id
       WHERE a.is_active = 1
       ORDER BY a.created_at DESC
       LIMIT 5`
    )
    .all();

  const completion = db
    .prepare(
      `SELECT
          COALESCE(SUM(CASE WHEN role = 'student' THEN 1 ELSE 0 END), 0) AS students_total,
          COALESCE(SUM(CASE WHEN role = 'student' AND photo_path IS NOT NULL THEN 1 ELSE 0 END), 0) AS students_with_photo,
          COALESCE(SUM(CASE WHEN role = 'student' AND length(trim(COALESCE(slogan, ''))) > 0 THEN 1 ELSE 0 END), 0) AS students_with_slogan
       FROM users`
    )
    .get();

  const topCommenters = db
    .prepare(
      `SELECT u.id, u.name, u.role, COUNT(m.id) AS message_count
       FROM messages m
       JOIN users u ON u.id = m.from_user_id
       GROUP BY u.id, u.name, u.role
       ORDER BY message_count DESC, u.name COLLATE NOCASE ASC
       LIMIT 10`
    )
    .all()
    .sort((a, b) => {
      const diff = Number(b.message_count || 0) - Number(a.message_count || 0);
      return diff !== 0 ? diff : compareTurkishText(a.name, b.name);
    });
  const topVisitedProfiles = db
    .prepare(
      `SELECT id, name, role, class_branch, photo_path, profile_visit_count
       FROM users
       WHERE role <> 'admin'
       ORDER BY profile_visit_count DESC, name COLLATE NOCASE ASC
       LIMIT 10`
    )
    .all()
    .filter((item) => Number(item.profile_visit_count || 0) > 0)
    .sort((a, b) => {
      const diff = Number(b.profile_visit_count || 0) - Number(a.profile_visit_count || 0);
      return diff !== 0 ? diff : compareTurkishText(a.name, b.name);
    });
  const topLikedProfiles = db
    .prepare(
      `SELECT u.id, u.name, u.role, u.class_branch, u.photo_path, COUNT(l.liker_user_id) AS like_count
       FROM profile_likes l
       JOIN users u ON u.id = l.profile_user_id
       WHERE u.role <> 'admin'
       GROUP BY u.id, u.name, u.role, u.class_branch, u.photo_path
       ORDER BY like_count DESC, u.name COLLATE NOCASE ASC
       LIMIT 10`
    )
    .all()
    .filter((item) => Number(item.like_count || 0) > 0)
    .sort((a, b) => {
      const diff = Number(b.like_count || 0) - Number(a.like_count || 0);
      return diff !== 0 ? diff : compareTurkishText(a.name, b.name);
    });

  const homeBackground = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'home_background_path'")
    .get();

  const heroTextSetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'home_hero_text'")
    .get();

  const birthdaysToday = db
    .prepare(
      `SELECT id, name, role, class_branch, birth_date
       FROM users
       WHERE birth_date IS NOT NULL
         AND strftime('%m-%d', birth_date) = strftime('%m-%d', 'now', 'localtime')
       ORDER BY role, class_branch, name`
    )
    .all()
    .sort(compareUsersTurkish);

  const graduationDateSetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'graduation_date'")
    .get();
  const closingTitleSetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'closing_title'")
    .get();
  const closingBodySetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'closing_body'")
    .get();

  return res.render('home', {
    title: 'Yıllık Ana Sayfa',
    classStats,
    teachersCount,
    latestMessages,
    announcements: isFeatureEnabled(req.featureFlags, 'announcements') ? announcements : [],
    completion,
    canPublishAnnouncements: isFeatureEnabled(req.featureFlags, 'announcements') && canPublishAnnouncements(req.currentUser),
    topCommenters,
    topVisitedProfiles,
    topLikedProfiles,
    birthdaysToday: isFeatureEnabled(req.featureFlags, 'birthdays') ? birthdaysToday : [],
    graduationDate: isFeatureEnabled(req.featureFlags, 'closing_page') && graduationDateSetting ? graduationDateSetting.setting_value : '',
    closingTitle: isFeatureEnabled(req.featureFlags, 'closing_page') && closingTitleSetting ? closingTitleSetting.setting_value : '',
    closingBody: isFeatureEnabled(req.featureFlags, 'closing_page') && closingBodySetting ? closingBodySetting.setting_value : '',
    homeBackgroundPath: homeBackground ? homeBackground.setting_value : '',
    homeHeroText: heroTextSetting ? heroTextSetting.setting_value : 'Sınıfları gezebilir, öğretmen profillerini inceleyebilir ve tek seferlik yıllık mesajlarını yazabilirsin.',
    allowedClasses: getActiveClassBranches()
  });
});

router.get('/closing', requireLogin, (req, res) => {
  if (!requireFeature(req, res, 'closing_page')) {
    return;
  }
  const graduationDateSetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'graduation_date'")
    .get();
  const closingTitleSetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'closing_title'")
    .get();
  const closingBodySetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'closing_body'")
    .get();

  return res.render('closing', {
    title: 'Kapanış Sayfası',
    graduationDate: graduationDateSetting ? graduationDateSetting.setting_value : '',
    closingTitle: closingTitleSetting ? closingTitleSetting.setting_value : 'Bir dönemin sonu',
    closingBody: closingBodySetting ? closingBodySetting.setting_value : 'Bu dijital yıllık, aynı sınıfta biriken anıları bir araya getiriyor.'
  });
});

router.get('/archive', requireLogin, (req, res) => {
  if (!req.archivePublic && req.currentUser.role !== 'admin') {
    req.flash('error', 'Arşiv görünümü kapalı.');
    return res.redirect('/');
  }

  const archivedYears = db
    .prepare(
      `SELECT id, label, archived_at, created_at
       FROM school_years
       WHERE is_archived = 1
       ORDER BY archived_at DESC, created_at DESC`
    )
    .all();

  const classRows = db
    .prepare(
      `SELECT ayc.branch, ayc.theme_color, ayc.cover_photo_path, ayc.class_slogan,
              y.id AS school_year_id, y.label AS school_year_label
       FROM archive_year_classes ayc
       JOIN school_years y ON y.id = ayc.school_year_id
       WHERE y.is_archived = 1
       ORDER BY y.created_at DESC, ayc.branch`
    )
    .all();

  const yearCards = archivedYears.map((year) => {
    const classes = classRows
      .filter((row) => row.school_year_id === year.id)
      .map((row) => {
        const schoolScope = getArchiveStudentWhere(req.currentUser, 'archived_school_year_id = ? AND archived_class_branch = ?');
        const students = db
          .prepare(
            `SELECT id, name, student_number, photo_path, slogan
             FROM users
             WHERE ${schoolScope.where}
             ORDER BY name`
          )
          .all(year.id, row.branch, ...schoolScope.params)
          .sort((a, b) => compareTurkishText(a.name, b.name));
        return {
          ...row,
          students
        };
      })
      .filter((row) => req.currentUser.role === 'admin' || row.students.length);
    return {
      ...year,
      classes
    };
  }).filter((year) => req.currentUser.role === 'admin' || year.classes.length);

  return res.render('archive', {
    title: 'Arşiv',
    yearCards
  });
});

router.get('/archive/:yearId', requireLogin, (req, res) => {
  if (!req.archivePublic && req.currentUser.role !== 'admin') {
    req.flash('error', 'Arşiv görünümü kapalı.');
    return res.redirect('/');
  }
  const yearId = Number(req.params.yearId || 0);
  const year = db
    .prepare('SELECT id, label, archived_at, created_at FROM school_years WHERE id = ? AND is_archived = 1')
    .get(yearId);
  if (!year) {
    req.flash('error', 'Arşiv yılı bulunamadı.');
    return res.redirect('/archive');
  }
  const classes = db
    .prepare(
      `SELECT branch, theme_color, cover_photo_path, class_slogan
       FROM archive_year_classes
       WHERE school_year_id = ?
       ORDER BY branch`
    )
    .all(year.id)
    .map((klass) => {
      const schoolScope = getArchiveStudentWhere(req.currentUser, 'archived_school_year_id = ? AND archived_class_branch = ?');
      const students = db
        .prepare(
          `SELECT id, name, student_number, photo_path, slogan, bio, free_text, favorite_memory, favorite_quote, birth_date
           FROM users
           WHERE ${schoolScope.where}
           ORDER BY name`
        )
        .all(year.id, klass.branch, ...schoolScope.params)
        .sort((a, b) => compareTurkishText(a.name, b.name));
      return { ...klass, students };
    })
    .filter((klass) => req.currentUser.role === 'admin' || klass.students.length);

  return res.render('archive-year', {
    title: `${year.label} Arşivi`,
    year,
    classes
  });
});

router.get('/archive/:yearId/profiles/:profileId', requireLogin, (req, res) => {
  if (!req.archivePublic && req.currentUser.role !== 'admin') {
    req.flash('error', 'Arşiv görünümü kapalı.');
    return res.redirect('/');
  }

  const yearId = Number(req.params.yearId || 0);
  const profileId = Number(req.params.profileId || 0);
  if (!Number.isInteger(yearId) || yearId <= 0 || !Number.isInteger(profileId) || profileId <= 0) {
    req.flash('error', 'Geçersiz arşiv profili.');
    return res.redirect('/archive');
  }

  const year = db
    .prepare('SELECT id, label, archived_at, created_at FROM school_years WHERE id = ? AND is_archived = 1')
    .get(yearId);
  if (!year) {
    req.flash('error', 'Arşiv yılı bulunamadı.');
    return res.redirect('/archive');
  }

  const schoolScope = getArchiveStudentWhere(req.currentUser, 'archived_school_year_id = ? AND id = ?');
  const profile = db
    .prepare(
      `SELECT id, name, student_number, role, archived_class_branch AS class_branch, photo_path, profile_cover_path,
              profile_theme_color, slogan, bio, free_text, favorite_memory, favorite_quote, birth_date,
              contact_phone, contact_email, contact_instagram, contact_x, contact_facebook, contact_linkedin,
              contact_nsocial, custom_contacts_json, profile_visit_count, status, created_at, updated_at
       FROM users
       WHERE ${schoolScope.where}
       LIMIT 1`
    )
    .get(yearId, profileId, ...schoolScope.params);

  if (!profile) {
    req.flash('error', 'Arşiv profili bulunamadı.');
    return res.redirect(`/archive/${yearId}`);
  }

  const messages = db
    .prepare(
      `SELECT m.id, m.message, m.created_at, m.updated_at,
              sender.id as sender_id, sender.name as sender_name, sender.photo_path as sender_photo_path
       FROM messages m
       JOIN users sender ON sender.id = m.from_user_id
       WHERE m.to_user_id = ?
       ORDER BY m.created_at DESC`
    )
    .all(profileId);
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
  const guestbookEntries = isFeatureEnabled(req.featureFlags, 'profile_guestbook')
    ? db
        .prepare(
          `SELECT g.id, g.body, g.created_at, g.updated_at, g.author_user_id,
                  author.name AS author_name, author.photo_path AS author_photo_path
           FROM profile_guestbook_entries g
           JOIN users author ON author.id = g.author_user_id
           WHERE g.profile_user_id = ?
           ORDER BY g.created_at DESC
           LIMIT 30`
        )
        .all(profileId)
    : [];
  const profileLikeCount = Number(
    db.prepare('SELECT COUNT(*) AS total FROM profile_likes WHERE profile_user_id = ?').get(profileId).total || 0
  );
  const normalizedProfileThemeColor = normalizeThemeColor(profile.profile_theme_color || '');
  const themePair = buildThemeAccentPair(normalizedProfileThemeColor || '');
  const customContactItems = normalizeCustomContacts(profile.custom_contacts_json).map((item) => ({
    ...item,
    href: getCustomContactHref(item)
  }));

  return res.render('archive-profile', {
    title: `${profile.name} Arşiv Profili`,
    year,
    profile,
    messages,
    threeWords,
    guestbookEntries,
    profileLikeCount,
    customContactItems,
    pageThemeColor: normalizedProfileThemeColor || '',
    pageThemeAltColor: themePair ? themePair.secondary : '',
    pageHasOwnColor: !!(normalizedProfileThemeColor)
  });
});

router.get('/games', requireLogin, (req, res) => {
  return res.render('games', {
    title: 'Oyunlarımız',
    featureFlags: buildFeatureFlags(db)
  });
});

router.get('/games/kenan', requireLogin, (req, res) => {
  return res.redirect('/games/kenan/play/');
});

router.get('/cookie-policy', (req, res) => {
  return res.render('cookie-policy', {
    title: 'Çerez Politikası'
  });
});

router.post('/cookie-consent', verifyCsrf, (req, res) => {
  const choice = stripHtml(req.body.choice || '') === 'accepted' ? 'accepted' : 'accepted';
  const backTo = stripHtml(req.body.back_to || '/');

  res.cookie('yearbook_cookie_consent', choice, {
    httpOnly: false,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: 1000 * 60 * 60 * 24 * 365
  });

  return res.redirect(safeRedirectPath(backTo, '/', ['yearbook.example']));
});

router.post('/announcements', requireAnnouncementPublisher, announcementPublishLimiter, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'announcements')) {
    return;
  }
  const title = stripHtml(req.body.title).slice(0, 120);
  const body = stripHtml(req.body.body).slice(0, 2000);

  if (!title || !body) {
    req.flash('error', 'Duyuru başlığı ve metni zorunludur.');
    return res.redirect('/');
  }

  if (isContentApprovalEnabled(db)) {
    createApprovalRequest(db, {
      itemType: 'teacher_farewell',
      actorUserId: req.currentUser.id,
      targetUserId: req.currentUser.id,
      payload: { body }
    });
    writeAuditLog({
      actorUserId: req.currentUser.id,
      action: 'content_approval_request_create',
      targetType: 'teacher_farewell_message',
      targetId: null,
      details: { itemType: 'teacher_farewell', teacherId: req.currentUser.id }
    });
    req.flash('success', 'Veda mesajı onaya gönderildi.');
    return res.redirect('/teachers');
  }

  const result = db.prepare(
    `INSERT INTO announcements (title, body, created_by_user_id)
     VALUES (?, ?, ?)`
  ).run(title, body, req.currentUser.id);

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: req.currentUser.role === 'teacher' ? 'teacher_announcement_create' : 'admin_announcement_create',
    targetType: 'announcement',
    targetId: Number(result.lastInsertRowid),
    details: { title, role: req.currentUser.role }
  });

  req.flash('success', 'Duyuru yayınlandı.');
  return res.redirect(req.currentUser.role === 'admin' ? '/admin' : '/');
});

router.get('/students', (req, res) => {
  if (!req.currentUser) {
    return redirectToLoginOrInactive(req, res);
  }

  const selectedClass = (req.query.class || '').toString().toUpperCase();
  const allowedClasses = getActiveClassBranches();
  const classFilter = allowedClasses.includes(selectedClass) ? selectedClass : null;

  const students = classFilter
    ? db
        .prepare(
          `SELECT id, name, student_number, class_branch, photo_path, slogan
           FROM users
           WHERE role = 'student' AND class_branch = ?
           ORDER BY name`
        )
        .all(classFilter)
        .sort((a, b) => compareTurkishText(a.name, b.name))
    : db
        .prepare(
          `SELECT id, name, student_number, class_branch, photo_path, slogan
           FROM users
           WHERE role = 'student'
           ORDER BY class_branch, name`
        )
        .all()
        .sort(compareUsersTurkish);

  return res.render('students', {
    title: 'Öğrenciler',
    students,
    selectedClass: classFilter,
    allowedClasses
  });
});

router.get('/teachers', (req, res) => {
  if (!req.currentUser) {
    return redirectToLoginOrInactive(req, res);
  }

  const teachers = db
    .prepare(
      `SELECT id, name, photo_path, slogan, teacher_category,
              CASE WHEN photo_path IS NOT NULL THEN 1 ELSE 0 END AS has_photo,
              CASE WHEN length(trim(COALESCE(slogan, ''))) > 0 THEN 1 ELSE 0 END AS has_slogan
       FROM users
       WHERE role = 'teacher'
       ORDER BY
         CASE teacher_category
           WHEN 'principal' THEN 1
           WHEN 'head_vice_principal' THEN 2
           WHEN 'vice_principal' THEN 3
           WHEN 'teacher' THEN 4
           ELSE 5
         END,
         name`
    )
    .all()
    .map((teacher) => ({
      ...teacher,
      teacher_category_label: teacherCategoryLabel(teacher.teacher_category)
    }));

  const farewellMessages = db
    .prepare(
      `SELECT m.id, m.teacher_user_id, m.body, m.created_at, m.author_user_id,
              teacher.name AS teacher_name, teacher.teacher_category, author.name AS author_name
       FROM teacher_farewell_messages m
       JOIN users teacher ON teacher.id = m.teacher_user_id
       JOIN users author ON author.id = m.author_user_id
       ORDER BY m.created_at DESC`
    )
    .all()
    .map((item) => ({
      ...item,
      teacher_category_label: teacherCategoryLabel(item.teacher_category)
    }));

  return res.render('teachers', {
    title: 'Öğretmenler',
    teachers,
    farewellMessages: isFeatureEnabled(req.featureFlags, 'teacher_farewells') ? farewellMessages : []
  });
});

router.post('/teachers/farewells', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'teacher_farewells', '/teachers')) {
    return;
  }
  const body = stripHtml(req.body.body || '').slice(0, MAX_FAREWELL_LENGTH);

  if (req.currentUser.role !== 'teacher') {
    req.flash('error', 'Veda mesajlarını yalnızca öğretmenler yazabilir.');
    return res.redirect('/teachers');
  }
  if (!body) {
    req.flash('error', 'Veda mesajı zorunludur.');
    return res.redirect('/teachers');
  }
  const moderation = validateContentText(db, body, { minLength: 5 });
  if (!moderation.ok) {
    req.flash('error', moderation.message);
    return res.redirect('/teachers');
  }

  const result = db.prepare(
    `INSERT INTO teacher_farewell_messages (teacher_user_id, author_user_id, body)
     VALUES (?, ?, ?)`
  ).run(req.currentUser.id, req.currentUser.id, body);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'teacher_farewell_create',
    targetType: 'teacher_farewell_message',
    targetId: Number(result.lastInsertRowid),
    details: { teacherId: req.currentUser.id }
  });
  req.flash('success', 'Veda mesajı kaydedildi.');
  return res.redirect('/teachers');
});

router.post('/teachers/farewells/:farewellId/delete', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'teacher_farewells', '/teachers')) {
    return;
  }
  const farewellId = Number(req.params.farewellId);
  const message = db
    .prepare('SELECT id, author_user_id FROM teacher_farewell_messages WHERE id = ?')
    .get(farewellId);

  if (!message) {
    req.flash('error', 'Veda mesajı bulunamadı.');
    return res.redirect('/teachers');
  }
  if (req.currentUser.role !== 'admin' && req.currentUser.id !== message.author_user_id) {
    req.flash('error', 'Bu veda mesajını silme yetkiniz yok.');
    return res.redirect('/teachers');
  }

  db.prepare('DELETE FROM teacher_farewell_messages WHERE id = ?').run(farewellId);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'teacher_farewell_delete',
    targetType: 'teacher_farewell_message',
    targetId: farewellId,
    details: {}
  });
  req.flash('success', 'Veda mesajı silindi.');
  return res.redirect('/teachers');
});

router.get('/search', (req, res) => {
  if (!req.currentUser) {
    return redirectToLoginOrInactive(req, res);
  }

  const rawQuery = stripHtml(req.query.q || '');
  const query = rawQuery.slice(0, 80);
  const normalizedQuery = normalizeTurkishSearchText(query);
  const selectedClassRaw = stripHtml(req.query.class_branch || '').toUpperCase();
  const allowedClasses = getActiveClassBranches();
  const selectedClass = allowedClasses.includes(selectedClassRaw) ? selectedClassRaw : '';

  let students = [];
  if (query || selectedClass) {
    students = db
      .prepare(
        `SELECT id, name, student_number, class_branch, photo_path, bio, slogan, role
         FROM users
         WHERE role = 'student'
         ORDER BY class_branch, name`
      )
      .all()
      .filter((student) => {
        if (selectedClass && student.class_branch !== selectedClass) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return (
          normalizeTurkishSearchText(student.name).includes(normalizedQuery) ||
          String(student.student_number || '').trim().toLocaleLowerCase('tr').includes(normalizedQuery) ||
          String(student.class_branch || '').trim().toLocaleLowerCase('tr') === normalizedQuery
        );
      })
      .sort(compareUsersTurkish)
      .slice(0, 100);
  }

  return res.render('search', {
    title: 'Öğrenci Arama',
    students,
    q: query,
    selectedClass,
    allowedClasses
  });
});

router.get('/search/suggestions', requireLogin, (req, res) => {
  const query = stripHtml(req.query.q || '').slice(0, 40);
  const normalizedQuery = normalizeTurkishSearchText(query);
  if (!query) {
    return res.json({ suggestions: [] });
  }

  const suggestions = db
    .prepare(
      `SELECT id, name, student_number, class_branch, role
       FROM users
       ORDER BY role, class_branch, name
       LIMIT 200`
    )
    .all()
    .filter((item) => (
      normalizeTurkishSearchText(item.name).includes(normalizedQuery) ||
      String(item.student_number || '').trim().toLocaleLowerCase('tr').includes(normalizedQuery) ||
      String(item.class_branch || '').trim().toLocaleLowerCase('tr').includes(normalizedQuery) ||
      String(item.role || '').trim().toLocaleLowerCase('tr').includes(normalizedQuery)
    ))
    .sort(compareUsersTurkish)
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      name: item.name,
      studentNumber: item.student_number || '',
      classBranch: item.class_branch || '',
      role: item.role === 'student' ? 'Öğrenci' : item.role === 'teacher' ? 'Öğretmen' : item.role === 'guest' ? 'Misafir' : 'Yönetici'
    }));

  return res.json({ suggestions });
});

router.get('/students/random', requireLogin, (req, res) => {
  const student = db.prepare("SELECT id FROM users WHERE role = 'student' ORDER BY RANDOM() LIMIT 1").get();
  if (!student) {
    req.flash('error', 'Rastgele gösterilecek öğrenci bulunamadı.');
    return res.redirect('/');
  }
  return res.redirect(`/profiles/${student.id}`);
});

router.get('/classes', (req, res) => {
  if (!req.currentUser) {
    return redirectToLoginOrInactive(req, res);
  }

  const classStats = db
    .prepare(
      `SELECT c.branch AS class_branch, COUNT(u.id) AS total,
              c.theme_color,
              cp.cover_photo_path,
              cp.class_slogan,
              president.id AS president_id,
              president.name AS president_name,
              president.photo_path AS president_photo_path
       FROM classes c
       LEFT JOIN users u ON u.class_branch = c.branch AND u.role = 'student'
       LEFT JOIN class_pages cp ON cp.class_branch = c.branch
       LEFT JOIN users president ON president.president_class_branch = c.branch
       WHERE c.is_active = 1 AND c.is_archived = 0 AND c.deleted_at IS NULL
       GROUP BY
         c.branch,
         c.theme_color,
         cp.cover_photo_path,
         cp.class_slogan,
         president.id,
         president.name,
         president.photo_path
       ORDER BY c.branch`
    )
    .all();

  return res.render('classes', {
    title: 'Sınıflar',
    classStats,
    allowedClasses: getActiveClassBranches()
  });
});

router.get('/classes/:branch', (req, res) => {
  if (!req.currentUser) {
    return redirectToLoginOrInactive(req, res);
  }

  const branch = stripHtml(req.params.branch || '').toUpperCase();
  if (!isValidClassBranch(branch)) {
    req.flash('error', 'Geçersiz sınıf şubesi.');
    return res.redirect('/classes');
  }

  const students = db
    .prepare(
      `SELECT id, name, student_number, class_branch, photo_path, slogan, favorite_quote,
              president_class_branch,
              CASE WHEN photo_path IS NOT NULL THEN 1 ELSE 0 END AS has_photo,
              CASE WHEN length(trim(COALESCE(slogan, ''))) > 0 THEN 1 ELSE 0 END AS has_slogan
       FROM users
       WHERE role = 'student' AND class_branch = ?
       ORDER BY name`
    )
    .all(branch)
    .sort((a, b) => compareTurkishText(a.name, b.name));

  const completion = {
    withPhoto: students.filter((student) => student.has_photo).length,
    withSlogan: students.filter((student) => student.has_slogan).length,
    total: students.length
  };

  const classPage = db
    .prepare(
      `SELECT cp.class_branch, cp.cover_photo_path, cp.class_slogan, cp.updated_at,
              c.theme_color,
              editor.name AS editor_name,
              president.id AS president_id, president.name AS president_name, president.photo_path AS president_photo_path
       FROM class_pages cp
       LEFT JOIN classes c ON c.branch = cp.class_branch
       LEFT JOIN users editor ON editor.id = cp.updated_by_user_id
       LEFT JOIN users president ON president.president_class_branch = cp.class_branch
       WHERE cp.class_branch = ?`
    )
    .get(branch) || {
      class_branch: branch,
      cover_photo_path: null,
      class_slogan: '',
      theme_color: '',
      updated_at: null,
      editor_name: null,
      president_id: null,
      president_name: null,
      president_photo_path: null
    };

  if (!classPage.theme_color) {
    const classRecord = db.prepare('SELECT theme_color FROM classes WHERE branch = ?').get(branch);
    classPage.theme_color = classRecord ? classRecord.theme_color || '' : '';
  }

  if (!classPage.president_name) {
    const president = db
      .prepare(
        `SELECT id, name, photo_path
         FROM users
         WHERE president_class_branch = ?
         LIMIT 1`
      )
      .get(branch);
    if (president) {
      classPage.president_id = president.id;
      classPage.president_name = president.name;
      classPage.president_photo_path = president.photo_path;
    }
  }

  const timelineEntries = db
    .prepare(
      `SELECT e.id, e.title, e.body, e.happened_on, e.created_at, u.name AS author_name
       FROM class_timeline_entries e
       JOIN users u ON u.id = e.created_by_user_id
       WHERE e.class_branch = ?
       ORDER BY COALESCE(e.happened_on, e.created_at) DESC, e.created_at DESC`
    )
    .all(branch);

  const classMemories = db
    .prepare(
      `SELECT m.id, m.body, m.created_at, m.created_by_user_id, u.name AS author_name
       FROM class_memories m
       JOIN users u ON u.id = m.created_by_user_id
       WHERE m.class_branch = ?
       ORDER BY m.created_at DESC`
    )
    .all(branch);

  const presidentAnnouncements = db
    .prepare(
      `SELECT a.id, a.title, a.body, a.created_at, a.updated_at, u.name AS author_name
       FROM class_president_announcements a
       JOIN users u ON u.id = a.created_by_user_id
       WHERE a.class_branch = ?
       ORDER BY a.created_at DESC`
    )
    .all(branch);

  const classAchievements = db
    .prepare(
      `SELECT a.id, a.title, a.body, a.created_at, u.name AS author_name
       FROM class_achievements a
       JOIN users u ON u.id = a.created_by_user_id
       WHERE a.class_branch = ?
       ORDER BY a.created_at DESC`
    )
    .all(branch);

  const featuredGalleryItems = db
    .prepare(
      `SELECT f.id, p.id AS photo_id, p.photo_path, p.caption, p.created_at, uploader.name AS uploader_name
       FROM class_featured_gallery_items f
       JOIN gallery_photos p ON p.id = f.photo_id
       JOIN users uploader ON uploader.id = p.uploader_user_id
       WHERE f.class_branch = ?
       ORDER BY f.created_at DESC`
    )
    .all(branch);

  const classGalleryCandidates = canEditClassPage(req.currentUser, branch)
    ? db
        .prepare(
          `SELECT id, photo_path, caption, created_at
           FROM gallery_photos
           WHERE class_branch = ? AND section = 'gallery'
           ORDER BY created_at DESC
           LIMIT 40`
        )
        .all(branch)
    : [];

  const rawPolls = db
    .prepare(
      `SELECT p.id, p.question, p.allow_multiple, p.is_closed, p.created_at, p.updated_at,
              u.name AS author_name
       FROM class_polls p
       JOIN users u ON u.id = p.created_by_user_id
       WHERE p.class_branch = ?
       ORDER BY p.created_at DESC`
    )
    .all(branch);

  const polls = rawPolls.map((poll) => {
    const options = db
      .prepare(
        `SELECT o.id, o.option_text, o.sort_order, COUNT(v.id) AS vote_count
         FROM class_poll_options o
         LEFT JOIN class_poll_votes v ON v.option_id = o.id
         WHERE o.poll_id = ?
         GROUP BY o.id, o.option_text, o.sort_order
         ORDER BY o.sort_order ASC, o.id ASC`
      )
      .all(poll.id);
    const myVotes = db
      .prepare('SELECT option_id FROM class_poll_votes WHERE poll_id = ? AND voter_user_id = ?')
      .all(poll.id, req.currentUser.id)
      .map((row) => row.option_id);
    return {
      ...poll,
      options,
      myVotes
    };
  });

  const themePair = buildThemeAccentPair(classPage.theme_color || '');

  return res.render('class-detail', {
    title: `${branch} Öğrencileri`,
    classBranch: branch,
    students,
    completion,
    classPage,
    pageThemeColor: classPage.theme_color || '',
    pageThemeAltColor: themePair ? themePair.secondary : '',
    pageHasOwnColor: !!(classPage.theme_color),
    pageThemeButtonColor: themePair ? themePair.primaryButton : '',
    pageThemeButtonAltColor: themePair ? themePair.secondaryButton : '',
    pageThemeButtonTextColor: themePair ? themePair.primaryText : '',
    pageThemeButtonAltTextColor: themePair ? themePair.secondaryText : '',
    timelineEntries: isFeatureEnabled(req.featureFlags, 'class_timeline') ? timelineEntries : [],
    classMemories: isFeatureEnabled(req.featureFlags, 'class_memories') ? classMemories : [],
    presidentAnnouncements: isFeatureEnabled(req.featureFlags, 'class_president_announcements') ? presidentAnnouncements : [],
    classAchievements: isFeatureEnabled(req.featureFlags, 'class_achievements') ? classAchievements : [],
    featuredGalleryItems: isFeatureEnabled(req.featureFlags, 'class_featured_gallery') ? featuredGalleryItems : [],
    classGalleryCandidates: isFeatureEnabled(req.featureFlags, 'class_featured_gallery') ? classGalleryCandidates : [],
    polls: isFeatureEnabled(req.featureFlags, 'class_polls') ? polls : [],
    canEditClassPage: canEditClassPage(req.currentUser, branch),
    canPostClassMemory: canPostClassMemory(req.currentUser, branch),
    canVoteInClassPoll: canVoteInClassPoll(req.currentUser, branch)
  });
});

router.post('/classes/:branch/cover', requireLogin, verifyCsrf, classCoverUpload.single('cover_photo'), (req, res) => {
  if (!requireFeature(req, res, 'class_pages', '/classes')) {
    return;
  }
  const branch = stripHtml(req.params.branch || '').toUpperCase();
  if (!isValidClassBranch(branch)) {
    req.flash('error', 'Geçersiz sınıf şubesi.');
    return res.redirect('/classes');
  }

  if (!canEditClassPage(req.currentUser, branch)) {
    req.flash('error', 'Bu sınıf kapak sayfasını düzenleme yetkiniz yok.');
    return res.redirect(`/classes/${branch}`);
  }

  const classSlogan = stripHtml(req.body.class_slogan || '').slice(0, 300);
  const themeColor = stripHtml(req.body.theme_color || '').slice(0, 20);
  if (themeColor && !HEX_COLOR_PATTERN.test(themeColor)) {
    req.flash('error', 'Tema rengi geçersiz.');
    return res.redirect(`/classes/${branch}`);
  }
  if (themeColor && !isReadableThemeColor(themeColor)) {
    req.flash('error', 'Tema rengi çok acik veya cok koyu olamaz.');
    return res.redirect(`/classes/${branch}`);
  }
  const safeThemeColor = themeColor ? normalizeThemeColor(themeColor) : '';
  const existingPage = db.prepare('SELECT cover_photo_path FROM class_pages WHERE class_branch = ?').get(branch);
  let nextPhotoPath = existingPage ? existingPage.cover_photo_path : null;

  if (req.file) {
    try {
      assertImageSignature(req.file);
    } catch (error) {
      deleteFileIfExists(`/uploads/class-covers/${req.file.filename}`);
      throw error;
    }
    nextPhotoPath = `/uploads/class-covers/${req.file.filename}`;
  }

  db.prepare(
    `INSERT INTO class_pages (class_branch, cover_photo_path, class_slogan, updated_by_user_id)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(class_branch) DO UPDATE SET
       cover_photo_path = excluded.cover_photo_path,
       class_slogan = excluded.class_slogan,
       updated_by_user_id = excluded.updated_by_user_id,
       updated_at = CURRENT_TIMESTAMP`
  ).run(branch, nextPhotoPath, classSlogan, req.currentUser.id);

  db.prepare(
    `UPDATE classes
     SET theme_color = ?, updated_at = CURRENT_TIMESTAMP
     WHERE branch = ?`
  ).run(safeThemeColor, branch);

  if (req.file && existingPage && existingPage.cover_photo_path) {
    deleteFileIfExists(existingPage.cover_photo_path);
  }

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'class_page_update',
    targetType: 'class_page',
    targetId: null,
    details: { classBranch: branch }
  });
  req.flash('success', `${branch} kapak sayfası güncellendi.`);
  return res.redirect(`/classes/${branch}`);
});

router.post('/classes/:branch/timeline', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'class_timeline', `/classes/${stripHtml(req.params.branch || '').toUpperCase()}`)) {
    return;
  }
  const branch = stripHtml(req.params.branch || '').toUpperCase();
  if (!isValidClassBranch(branch) || !canEditClassPage(req.currentUser, branch)) {
    req.flash('error', 'Bu sınıf için zaman çizelgesi ekleme yetkiniz yok.');
    return res.redirect(isValidClassBranch(branch) ? `/classes/${branch}` : '/classes');
  }

  const title = stripHtml(req.body.title || '').slice(0, 120);
  const body = stripHtml(req.body.body || '').slice(0, 1200);
  const happenedOn = stripHtml(req.body.happened_on || '').slice(0, 20);
  if (!title || !body) {
    req.flash('error', 'Başlık ve açıklama zorunludur.');
    return res.redirect(`/classes/${branch}`);
  }

  db.prepare(
    `INSERT INTO class_timeline_entries (class_branch, title, body, happened_on, created_by_user_id)
     VALUES (?, ?, ?, ?, ?)`
  ).run(branch, title, body, happenedOn || null, req.currentUser.id);

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'class_timeline_create',
    targetType: 'class',
    targetId: null,
    details: { branch, title }
  });
  req.flash('success', 'Zaman çizelgesine kayıt eklendi.');
  return res.redirect(`/classes/${branch}`);
});

router.post('/classes/:branch/timeline/:entryId/delete', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'class_timeline', `/classes/${stripHtml(req.params.branch || '').toUpperCase()}`)) {
    return;
  }
  const branch = stripHtml(req.params.branch || '').toUpperCase();
  const entryId = Number.parseInt(req.params.entryId, 10);

  if (!isValidClassBranch(branch) || !Number.isInteger(entryId) || entryId < 1) {
    req.flash('error', 'Geçersiz zaman çizelgesi kaydı.');
    return res.redirect(isValidClassBranch(branch) ? `/classes/${branch}` : '/classes');
  }

  if (!canEditClassPage(req.currentUser, branch)) {
    req.flash('error', 'Bu sınıf için zaman çizelgesini yönetme yetkiniz yok.');
    return res.redirect(`/classes/${branch}`);
  }

  const entry = db
    .prepare('SELECT id, title FROM class_timeline_entries WHERE id = ? AND class_branch = ?')
    .get(entryId, branch);

  if (!entry) {
    req.flash('error', 'Zaman çizelgesi kaydı bulunamadı.');
    return res.redirect(`/classes/${branch}`);
  }

  db.prepare('DELETE FROM class_timeline_entries WHERE id = ?').run(entryId);

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'class_timeline_delete',
    targetType: 'class_timeline_entry',
    targetId: entryId,
    details: { branch, title: entry.title }
  });

  req.flash('success', 'Zaman çizelgesi kaydı silindi.');
  return res.redirect(`/classes/${branch}`);
});

router.post('/classes/:branch/memories', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'class_memories', `/classes/${stripHtml(req.params.branch || '').toUpperCase()}`)) {
    return;
  }
  const branch = stripHtml(req.params.branch || '').toUpperCase();
  if (!isValidClassBranch(branch) || !canPostClassMemory(req.currentUser, branch)) {
    req.flash('error', 'Bu sınıf için anı ekleme yetkiniz yok.');
    return res.redirect(isValidClassBranch(branch) ? `/classes/${branch}` : '/classes');
  }

  const body = stripHtml(req.body.body || '').slice(0, 1500);
  if (!body) {
    req.flash('error', 'Anı metni zorunludur.');
    return res.redirect(`/classes/${branch}`);
  }

  db.prepare(
    `INSERT INTO class_memories (class_branch, body, created_by_user_id)
     VALUES (?, ?, ?)`
  ).run(branch, body, req.currentUser.id);

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'class_memory_create',
    targetType: 'class',
    targetId: null,
    details: { branch }
  });
  req.flash('success', 'Sınıf anısı eklendi.');
  return res.redirect(`/classes/${branch}`);
});

router.post('/classes/:branch/memories/:memoryId/delete', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'class_memories', `/classes/${stripHtml(req.params.branch || '').toUpperCase()}`)) {
    return;
  }
  const branch = stripHtml(req.params.branch || '').toUpperCase();
  const memoryId = Number.parseInt(req.params.memoryId, 10);

  if (!isValidClassBranch(branch) || !Number.isInteger(memoryId) || memoryId < 1) {
    req.flash('error', 'Geçersiz sınıf anısı.');
    return res.redirect(isValidClassBranch(branch) ? `/classes/${branch}` : '/classes');
  }

  const memory = db
    .prepare('SELECT id, body, created_by_user_id FROM class_memories WHERE id = ? AND class_branch = ?')
    .get(memoryId, branch);

  if (!memory) {
    req.flash('error', 'Sınıf anısı bulunamadı.');
    return res.redirect(`/classes/${branch}`);
  }

  if (!canDeleteClassMemory(req.currentUser, memory, branch)) {
    req.flash('error', 'Bu sınıf anısını silme yetkiniz yok.');
    return res.redirect(`/classes/${branch}`);
  }

  db.prepare('DELETE FROM class_memories WHERE id = ?').run(memoryId);

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'class_memory_delete',
    targetType: 'class_memory',
    targetId: memoryId,
    details: { branch }
  });

  req.flash('success', 'Sınıf anısı silindi.');
  return res.redirect(`/classes/${branch}`);
});

router.post('/classes/:branch/announcements', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'class_president_announcements', `/classes/${stripHtml(req.params.branch || '').toUpperCase()}`)) {
    return;
  }
  const branch = stripHtml(req.params.branch || '').toUpperCase();
  const title = stripHtml(req.body.title || '').slice(0, 120);
  const body = stripHtml(req.body.body || '').slice(0, 1500);

  if (!isValidClassBranch(branch) || !canEditClassPage(req.currentUser, branch)) {
    req.flash('error', 'Bu sınıf için duyuru ekleme yetkiniz yok.');
    return res.redirect(isValidClassBranch(branch) ? `/classes/${branch}` : '/classes');
  }
  if (!title || !body) {
    req.flash('error', 'Duyuru başlığı ve metni zorunludur.');
    return res.redirect(`/classes/${branch}`);
  }

  const result = db.prepare(
    `INSERT INTO class_president_announcements (class_branch, title, body, created_by_user_id)
     VALUES (?, ?, ?, ?)`
  ).run(branch, title, body, req.currentUser.id);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'class_president_announcement_create',
    targetType: 'class_president_announcement',
    targetId: Number(result.lastInsertRowid),
    details: { branch, title }
  });
  req.flash('success', 'Sınıf duyurusu eklendi.');
  return res.redirect(`/classes/${branch}`);
});

router.post('/classes/:branch/announcements/:announcementId/delete', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'class_president_announcements', `/classes/${stripHtml(req.params.branch || '').toUpperCase()}`)) {
    return;
  }
  const branch = stripHtml(req.params.branch || '').toUpperCase();
  const announcementId = Number.parseInt(req.params.announcementId, 10);

  if (!isValidClassBranch(branch) || !Number.isInteger(announcementId) || announcementId < 1 || !canEditClassPage(req.currentUser, branch)) {
    req.flash('error', 'Bu duyuruyu silme yetkiniz yok.');
    return res.redirect(isValidClassBranch(branch) ? `/classes/${branch}` : '/classes');
  }

  db.prepare('DELETE FROM class_president_announcements WHERE id = ? AND class_branch = ?').run(announcementId, branch);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'class_president_announcement_delete',
    targetType: 'class_president_announcement',
    targetId: announcementId,
    details: { branch }
  });
  req.flash('success', 'Sınıf duyurusu silindi.');
  return res.redirect(`/classes/${branch}`);
});

router.post('/classes/:branch/achievements', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'class_achievements', `/classes/${stripHtml(req.params.branch || '').toUpperCase()}`)) {
    return;
  }
  const branch = stripHtml(req.params.branch || '').toUpperCase();
  const title = stripHtml(req.body.title || '').slice(0, 120);
  const body = stripHtml(req.body.body || '').slice(0, 1000);

  if (!isValidClassBranch(branch) || !canEditClassPage(req.currentUser, branch)) {
    req.flash('error', 'Bu sınıf için başarı ekleme yetkiniz yok.');
    return res.redirect(isValidClassBranch(branch) ? `/classes/${branch}` : '/classes');
  }
  if (!title || !body) {
    req.flash('error', 'Başlık ve açıklama zorunludur.');
    return res.redirect(`/classes/${branch}`);
  }

  const result = db.prepare(
    `INSERT INTO class_achievements (class_branch, title, body, created_by_user_id)
     VALUES (?, ?, ?, ?)`
  ).run(branch, title, body, req.currentUser.id);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'class_achievement_create',
    targetType: 'class_achievement',
    targetId: Number(result.lastInsertRowid),
    details: { branch, title }
  });
  req.flash('success', 'Başarı panosuna kayıt eklendi.');
  return res.redirect(`/classes/${branch}`);
});

router.post('/classes/:branch/achievements/:achievementId/delete', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'class_achievements', `/classes/${stripHtml(req.params.branch || '').toUpperCase()}`)) {
    return;
  }
  const branch = stripHtml(req.params.branch || '').toUpperCase();
  const achievementId = Number.parseInt(req.params.achievementId, 10);

  if (!isValidClassBranch(branch) || !Number.isInteger(achievementId) || achievementId < 1 || !canEditClassPage(req.currentUser, branch)) {
    req.flash('error', 'Bu başarı kaydını silme yetkiniz yok.');
    return res.redirect(isValidClassBranch(branch) ? `/classes/${branch}` : '/classes');
  }

  db.prepare('DELETE FROM class_achievements WHERE id = ? AND class_branch = ?').run(achievementId, branch);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'class_achievement_delete',
    targetType: 'class_achievement',
    targetId: achievementId,
    details: { branch }
  });
  req.flash('success', 'Başarı kaydı silindi.');
  return res.redirect(`/classes/${branch}`);
});

router.post('/classes/:branch/featured-gallery', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'class_featured_gallery', `/classes/${stripHtml(req.params.branch || '').toUpperCase()}`)) {
    return;
  }
  const branch = stripHtml(req.params.branch || '').toUpperCase();
  const photoId = Number.parseInt(req.body.photo_id || '', 10);

  if (!isValidClassBranch(branch) || !canEditClassPage(req.currentUser, branch)) {
    req.flash('error', 'Bu sınıf için öne çıkan galeri seçme yetkiniz yok.');
    return res.redirect(isValidClassBranch(branch) ? `/classes/${branch}` : '/classes');
  }
  if (!Number.isInteger(photoId) || photoId < 1) {
    req.flash('error', 'Geçerli bir fotoğraf seçmelisiniz.');
    return res.redirect(`/classes/${branch}`);
  }

  const photo = db.prepare('SELECT id FROM gallery_photos WHERE id = ? AND class_branch = ?').get(photoId, branch);
  if (!photo) {
    req.flash('error', 'Seçilen fotoğraf bu sınıfa ait değil.');
    return res.redirect(`/classes/${branch}`);
  }

  db.prepare(
    `INSERT OR IGNORE INTO class_featured_gallery_items (class_branch, photo_id, created_by_user_id)
     VALUES (?, ?, ?)`
  ).run(branch, photoId, req.currentUser.id);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'class_featured_gallery_add',
    targetType: 'class_featured_gallery_item',
    targetId: photoId,
    details: { branch }
  });
  req.flash('success', 'Fotoğraf sınıf öne çıkanlarına eklendi.');
  return res.redirect(`/classes/${branch}`);
});

router.post('/classes/:branch/featured-gallery/:itemId/delete', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'class_featured_gallery', `/classes/${stripHtml(req.params.branch || '').toUpperCase()}`)) {
    return;
  }
  const branch = stripHtml(req.params.branch || '').toUpperCase();
  const itemId = Number.parseInt(req.params.itemId, 10);

  if (!isValidClassBranch(branch) || !Number.isInteger(itemId) || itemId < 1 || !canEditClassPage(req.currentUser, branch)) {
    req.flash('error', 'Bu öne çıkan fotoğrafı silme yetkiniz yok.');
    return res.redirect(isValidClassBranch(branch) ? `/classes/${branch}` : '/classes');
  }

  db.prepare('DELETE FROM class_featured_gallery_items WHERE id = ? AND class_branch = ?').run(itemId, branch);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'class_featured_gallery_delete',
    targetType: 'class_featured_gallery_item',
    targetId: itemId,
    details: { branch }
  });
  req.flash('success', 'Öne çıkan fotoğraf kaldırıldı.');
  return res.redirect(`/classes/${branch}`);
});

router.post('/classes/:branch/polls', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'class_polls', `/classes/${stripHtml(req.params.branch || '').toUpperCase()}`)) {
    return;
  }
  const branch = stripHtml(req.params.branch || '').toUpperCase();
  const question = stripHtml(req.body.question || '').slice(0, 180);
  const options = String(req.body.options || '')
    .split('\n')
    .map((line) => stripHtml(line).trim())
    .filter(Boolean)
    .slice(0, 8);
  const allowMultiple = req.body.allow_multiple === 'yes' ? 1 : 0;

  if (!isValidClassBranch(branch) || !canEditClassPage(req.currentUser, branch)) {
    req.flash('error', 'Bu sınıf için anket oluşturma yetkiniz yok.');
    return res.redirect(isValidClassBranch(branch) ? `/classes/${branch}` : '/classes');
  }
  if (!question || options.length < 2) {
    req.flash('error', 'Anket sorusu ve en az 2 seçenek zorunludur.');
    return res.redirect(`/classes/${branch}`);
  }

  const tx = db.transaction(() => {
    const pollResult = db.prepare(
      `INSERT INTO class_polls (class_branch, question, allow_multiple, created_by_user_id)
       VALUES (?, ?, ?, ?)`
    ).run(branch, question, allowMultiple, req.currentUser.id);
    const pollId = Number(pollResult.lastInsertRowid);
    const insertOption = db.prepare(
      `INSERT INTO class_poll_options (poll_id, option_text, sort_order)
       VALUES (?, ?, ?)`
    );
    options.forEach((optionText, index) => insertOption.run(pollId, optionText, index));
    return pollId;
  });
  const pollId = tx();

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'class_poll_create',
    targetType: 'class_poll',
    targetId: pollId,
    details: { branch, question }
  });
  req.flash('success', 'Sınıf anketi oluşturuldu.');
  return res.redirect(`/classes/${branch}`);
});

router.post('/classes/:branch/polls/:pollId/vote', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'class_polls', `/classes/${stripHtml(req.params.branch || '').toUpperCase()}`)) {
    return;
  }
  const branch = stripHtml(req.params.branch || '').toUpperCase();
  const pollId = Number.parseInt(req.params.pollId, 10);

  if (!isValidClassBranch(branch) || !Number.isInteger(pollId) || pollId < 1 || !canVoteInClassPoll(req.currentUser, branch)) {
    req.flash('error', 'Bu anket için oy kullanma yetkiniz yok.');
    return res.redirect(isValidClassBranch(branch) ? `/classes/${branch}` : '/classes');
  }

  const poll = db.prepare('SELECT id, allow_multiple, is_closed FROM class_polls WHERE id = ? AND class_branch = ?').get(pollId, branch);
  if (!poll || poll.is_closed) {
    req.flash('error', 'Anket bulunamadı veya oylamaya kapalı.');
    return res.redirect(`/classes/${branch}`);
  }

  const rawOptions = req.body.option_ids;
  const optionIds = (Array.isArray(rawOptions) ? rawOptions : [rawOptions])
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (!optionIds.length) {
    req.flash('error', 'En az bir seçenek seçmelisiniz.');
    return res.redirect(`/classes/${branch}`);
  }
  if (!poll.allow_multiple && optionIds.length > 1) {
    req.flash('error', 'Bu ankette yalnızca tek oy kullanılabilir.');
    return res.redirect(`/classes/${branch}`);
  }

  const validOptionIds = db
    .prepare('SELECT id FROM class_poll_options WHERE poll_id = ?')
    .all(pollId)
    .map((row) => row.id);
  const filteredOptionIds = [...new Set(optionIds.filter((id) => validOptionIds.includes(id)))];
  if (!filteredOptionIds.length) {
    req.flash('error', 'Geçerli bir seçenek seçmelisiniz.');
    return res.redirect(`/classes/${branch}`);
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM class_poll_votes WHERE poll_id = ? AND voter_user_id = ?').run(pollId, req.currentUser.id);
    const insertVote = db.prepare(
      `INSERT INTO class_poll_votes (poll_id, option_id, voter_user_id)
       VALUES (?, ?, ?)`
    );
    filteredOptionIds.forEach((optionId) => insertVote.run(pollId, optionId, req.currentUser.id));
  });
  tx();

  req.flash('success', 'Oyun kaydedildi.');
  return res.redirect(`/classes/${branch}`);
});

router.post('/classes/:branch/polls/:pollId/toggle', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'class_polls', `/classes/${stripHtml(req.params.branch || '').toUpperCase()}`)) {
    return;
  }
  const branch = stripHtml(req.params.branch || '').toUpperCase();
  const pollId = Number.parseInt(req.params.pollId, 10);

  if (!isValidClassBranch(branch) || !Number.isInteger(pollId) || pollId < 1 || !canEditClassPage(req.currentUser, branch)) {
    req.flash('error', 'Bu anketi yönetme yetkiniz yok.');
    return res.redirect(isValidClassBranch(branch) ? `/classes/${branch}` : '/classes');
  }

  const poll = db.prepare('SELECT id, is_closed FROM class_polls WHERE id = ? AND class_branch = ?').get(pollId, branch);
  if (!poll) {
    req.flash('error', 'Anket bulunamadı.');
    return res.redirect(`/classes/${branch}`);
  }

  db.prepare('UPDATE class_polls SET is_closed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(poll.is_closed ? 0 : 1, pollId);
  req.flash('success', poll.is_closed ? 'Anket yeniden açıldı.' : 'Anket oylamaya kapatıldı.');
  return res.redirect(`/classes/${branch}`);
});

router.post('/classes/:branch/polls/:pollId/delete', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'class_polls', `/classes/${stripHtml(req.params.branch || '').toUpperCase()}`)) {
    return;
  }
  const branch = stripHtml(req.params.branch || '').toUpperCase();
  const pollId = Number.parseInt(req.params.pollId, 10);

  if (!isValidClassBranch(branch) || !Number.isInteger(pollId) || pollId < 1 || !canEditClassPage(req.currentUser, branch)) {
    req.flash('error', 'Bu anketi silme yetkiniz yok.');
    return res.redirect(isValidClassBranch(branch) ? `/classes/${branch}` : '/classes');
  }

  db.prepare('DELETE FROM class_polls WHERE id = ? AND class_branch = ?').run(pollId, branch);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'class_poll_delete',
    targetType: 'class_poll',
    targetId: pollId,
    details: { branch }
  });
  req.flash('success', 'Anket silindi.');
  return res.redirect(`/classes/${branch}`);
});

router.get('/print/classes/:branch', requireLogin, (req, res) => {
  const branch = stripHtml(req.params.branch || '').toUpperCase();
  if (!isValidClassBranch(branch)) {
    return res.status(404).render('404', { title: 'Sayfa Bulunamadı' });
  }

  const students = db
    .prepare(
      `SELECT id, name, student_number, class_branch, photo_path, slogan
       FROM users
       WHERE role = 'student' AND class_branch = ?
       ORDER BY name`
    )
    .all(branch);

  const classPage = db
    .prepare('SELECT class_branch, cover_photo_path, class_slogan FROM class_pages WHERE class_branch = ?')
    .get(branch);

  return res.render('print-class', {
    title: `${branch} Yazdır`,
    classBranch: branch,
    students,
    classPage
  });
});

router.get('/print/teachers', requireLogin, (req, res) => {
  const teachers = db
    .prepare(
      `SELECT id, name, photo_path, slogan, teacher_category
       FROM users
       WHERE role = 'teacher'
       ORDER BY
         CASE teacher_category
           WHEN 'principal' THEN 1
           WHEN 'head_vice_principal' THEN 2
           WHEN 'vice_principal' THEN 3
           WHEN 'teacher' THEN 4
           ELSE 5
         END,
         name`
    )
    .all()
    .map((teacher) => ({
      ...teacher,
      teacher_category_label: teacherCategoryLabel(teacher.teacher_category)
    }));

  return res.render('print-teachers', {
    title: 'Öğretmenler Yazdır',
    teachers
  });
});

router.get('/health', requireAdmin, (req, res) => {
  const dbCheck = db.prepare('SELECT 1 AS ok').get();
  return res.json({
    ok: true,
    database: dbCheck && dbCheck.ok === 1,
    maintenance: Boolean(req.maintenanceState),
    timestamp: new Date().toISOString()
  });
});

router.use((error, req, res, next) => {
  if (error && error.message) {
    logError(error, {
      path: req.originalUrl,
      method: req.method,
      userId: req.currentUser ? req.currentUser.id : null
    });
    req.flash('error', error.message);
    const branch = stripHtml(req.params.branch || '').toUpperCase();
    if (isValidClassBranch(branch, { includeArchived: true })) {
      return res.redirect(`/classes/${branch}`);
    }
    return res.status(500).render('500', { title: 'Sunucu Hatası' });
  }
  return next(error);
});

module.exports = router;
